# Data manipulation
from sklearn.metrics.pairwise import cosine_similarity
from surprise import Reader
from surprise import Dataset
from surprise import SVD
from surprise.model_selection import train_test_split
import numpy as np
import pandas as pd
from timeit import default_timer as timer
from surprise import accuracy
import sqlite3
import pandas as pd


class MovieRecommender:
    def __init__(self, data_path, evaluate=False):
        self.data_path = data_path
        self.df = None
        self.user_mapping = None
        self.item_mapping = None
        self.model = None
        self.trainset = None
        self.testset = None
        self.loaded_df = None
        self.eval = evaluate

    def get_movie_id(self, slug):
        """
        Get the internal movie ID from the movie slug
        """
        return self.item_mapping.tolist().index(slug)

    def get_movie_name(self, id):
        """
        Get the movie slug from the internal movie ID
        """
        return self.item_mapping[id]

    def get_user_id(self, username):
        """
        Get the internal user ID from the username
        """
        return self.user_mapping.tolist().index(username)

    def get_user_name(self, id):
        """
        Get the username from the internal user ID
        """
        return self.user_mapping[id]

    def preprocess(self, usernames, user_profiles, n_samples=5000000):
        """
        Preprocess the data
        """
        timer_start = timer()

        if self.loaded_df is None:
            # Load existing data
            self.df = pd.read_parquet(self.data_path, engine='pyarrow')
            self.loaded_df = self.df.copy()
        else:
            print("Using already loaded data")
            self.df = self.loaded_df.copy()

        # # Only keep movies with more than 1000 ratings and users with more than 10 ratings
        # movie_counts = self.df["movieId"].value_counts()
        # user_counts = self.df["userId"].value_counts()
        # self.df = self.df[self.df["movieId"].isin(movie_counts[movie_counts >= 1000].index)]
        # self.df = self.df[self.df["userId"].isin(user_counts[user_counts >= 10].index)]
        # # Store to parquet
        # self.df.to_parquet("data/ratings_filtered.parquet", engine='pyarrow')

        # Sample random rows for faster training
        if n_samples < len(self.df):
            print(f"Sampling {n_samples} random rows out of {len(self.df)}")
            idx = np.random.choice(self.df.index, size=n_samples, replace=False)
            self.df = self.df.loc[idx]

        # Add ratings from our app users
        new_rows = []
        for username in usernames:
            user_profile = user_profiles[username]
            new_rows.extend([(username, movie_slug, rating) for movie_slug, rating in user_profile.get_ratings().items()])
        new_df = pd.DataFrame(new_rows, columns=self.df.columns)
        self.df = pd.concat([self.df, new_df], ignore_index=True)  # Single concat is faster

        # Factorize user and movie IDs
        self.df["userId"], self.user_mapping = pd.factorize(self.df["userId"])
        self.df["movieId"], self.item_mapping = pd.factorize(self.df["movieId"])

        # Load dataset for Surprise
        min_rating = self.df.rating.min()
        max_rating = self.df.rating.max()
        reader = Reader(rating_scale=(min_rating, max_rating))
        data = Dataset.load_from_df(self.df[["userId", "movieId", "rating"]], reader)

        if self.eval:
            self.trainset, self.testset = train_test_split(data, test_size=0.2)
        else:
            self.trainset = data.build_full_trainset()

        print("Dataset loaded in", timer() - timer_start, "seconds")

    def train_model(self, n_factors=50, n_epochs=10):
        """
        Train the model
        """
        timer_start = timer()

        # Train the model
        print(f"Train SVD model with {n_factors} factors for {n_epochs} epochs...")
        self.model = SVD(n_factors=n_factors, n_epochs=n_epochs, verbose=True)
        self.model.fit(self.trainset)
        print(f"Training took {timer() - timer_start} seconds")

        if self.eval:
            print("RMSE on test set:", self.evaluate_model())

    def evaluate_model(self):
        """
        Evaluate the model
        """
        timer_start = timer()

        print("Evaluating model...")
        if self.model is None or self.testset is None:
            raise ValueError("Initialize test data before evaluating the model.")

        predictions = self.model.test(self.testset)
        rmse = accuracy.rmse(predictions)

        print(f"Evaluation took {timer() - timer_start} seconds")

        return rmse

    def get_prediction(self, username, movie_slug):
        """
        Get the predicted user rating for a specific movie
        """
        user_id = self.get_user_id(username)

        if movie_slug in self.item_mapping:
            movie_id = self.get_movie_id(movie_slug)
            prediction = self.model.predict(user_id, movie_id)
            return prediction.est
        else:
            return None

    def get_predictions(self, username, movie_slugs, sorted=True, n_items=None):
        """
        Get the predicted user ratings for a list of movies
        """
        user_id = self.get_user_id(username)
        movie_ids = [self.get_movie_id(slug) for slug in movie_slugs if slug in self.item_mapping]

        # Apply a rating of 4 to all interactions (only to match the Surprise dataset format)
        test_set = [[user_id, movie_id, 4] for movie_id in movie_ids]
        predictions = self.model.test(test_set)

        pred_ratings = np.array([pred.est for pred in predictions])
        if not sorted:
            return pred_ratings

        if n_items is None:
            n_items = len(movie_ids)
        index_max = (-pred_ratings).argsort()[:n_items]

        preds = [(self.get_movie_name(movie_ids[i]), pred_ratings[i]) for i in index_max]
        return preds


def get_common_watchlist(username1, username2, user_profiles, recommender):
    """
    Get common watchlist between two users
    """
    user1_watchlist = user_profiles[username1].get_watchlist()
    user2_watchlist = user_profiles[username2].get_watchlist()

    # Get intersection
    all_slugs = list(user1_watchlist.intersection(user2_watchlist))

    # Separate slugs into those who are in the recommender model and those who are not
    common_slugs = [slug for slug in all_slugs if slug in recommender.item_mapping]
    common_slugs_not_in_model = [slug for slug in all_slugs if slug not in recommender.item_mapping]

    # Get predicted ratings for common movies
    preds_user1 = recommender.get_predictions(username1, common_slugs, sorted=False)
    preds_user2 = recommender.get_predictions(username2, common_slugs, sorted=False)

    preds_avg = [(slug, (preds_user1[i] + preds_user2[i]) / 2.0) for i, slug in enumerate(common_slugs)]

    # Sort by predicted rating
    preds_avg.sort(key=lambda x: x[1], reverse=True)

    # Add movies that are not in the model to the end of the list
    preds_avg.extend([(slug, None) for slug in common_slugs_not_in_model])

    # Return sorted list of common movies
    return [slug for slug, _ in preds_avg]


def get_single_watchlist(username1, username2, user_profiles, recommender):
    """
    Get watchlist of user1 that user2 has not seen yet, ordered by predicted rating of user2
    """

    user2_seen_slugs = user_profiles[username2].get_watched()
    user1_watchlist_slugs = user_profiles[username1].get_watchlist()
    user2_watchlist_slugs = user_profiles[username2].get_watchlist()

    # Get all movies of user2 that user1 has not seen yet
    diff_slugs = user1_watchlist_slugs.difference(user2_seen_slugs)
    diff_slugs = diff_slugs.difference(user2_watchlist_slugs)
    diff_slugs = [slug for slug in diff_slugs if slug in recommender.item_mapping]

    # Get predicted ratings for common movies
    preds_user2 = recommender.get_predictions(username2, diff_slugs, sorted=False)

    preds = [(slug, preds_user2[i]) for i, slug in enumerate(diff_slugs)]

    # Sort by predicted rating
    preds.sort(key=lambda x: x[1], reverse=True)
    preds = preds

    # Return sorted list of common movies
    return [slug for slug, _ in preds]


def get_rewatchlist(username1, username2, user_profiles, recommender):
    """
    Get rewatchlist of user1 that user2 has not seen yet, ordered by predicted rating of user2
    """

    user1_seen_slugs = user_profiles[username1].get_watched()
    user2_seen_slugs = user_profiles[username2].get_watched()

    # Get all movies of user2 that user1 has not seen yet
    diff_slugs = list(user1_seen_slugs.difference(user2_seen_slugs))
    diff_slugs = [slug for slug in diff_slugs if slug in recommender.item_mapping]

    # Get predicted ratings for common movies
    preds_user2 = recommender.get_predictions(username2, diff_slugs, sorted=False)

    preds = [(slug, preds_user2[i]) for i, slug in enumerate(diff_slugs)]

    # Sort by predicted rating
    preds.sort(key=lambda x: x[1], reverse=True)
    preds = preds

    # Return sorted list of common movies
    return [slug for slug, _ in preds]


def get_recommendations(username1, username2, weight, user_profiles, recommender):
    """
    Get recommendations based on two users
    """
    all_seen1 = user_profiles[username1].get_watched()
    all_seen2 = user_profiles[username2].get_watched()

    w1 = 1.0
    w2 = 1.0
    if weight == -1:
        w2 = 0
        seen_slugs = all_seen1
    elif weight == 1:
        w1 = 0
        seen_slugs = all_seen2
    else:
        seen_slugs = all_seen1.union(all_seen2)

    all_movie_ids = recommender.df["movieId"].unique()
    all_movie_slugs = {recommender.get_movie_name(movie_id) for movie_id in all_movie_ids}

    slugs_to_pred = list(all_movie_slugs.difference(seen_slugs))

    user_1_preds = recommender.get_predictions(username1, slugs_to_pred, sorted=False)
    user_2_preds = recommender.get_predictions(username2, slugs_to_pred, sorted=False)
    avg_preds = [(slugs_to_pred[i], ((w1*user_1_preds[i] + w2*user_2_preds[i]) / (w1+w2))) for i in range(len(slugs_to_pred))]

    index_max = (-np.array([pred[1] for pred in avg_preds])).argsort()
    top_slugs = [avg_preds[i][0] for i in index_max]
    scores = [avg_preds[i][1] for i in index_max]

    # Combine scores in dictionary
    scores_dict = {slug: score for slug, score in zip(top_slugs, scores)}

    return top_slugs, scores_dict


def get_similar_movies(movie_slug, recommender, top_n=5):
    """
    Get similar movies to a given movie
    """
    try:
        movie_id = recommender.get_movie_id(movie_slug)
        movie_id_mapping = {inner_id: recommender.trainset.to_raw_iid(inner_id) for inner_id in recommender.trainset.all_items()}
        inner_id = recommender.trainset.to_inner_iid(movie_id)

        movie_embeddings = recommender.model.qi
        similarities = cosine_similarity([movie_embeddings[inner_id]], movie_embeddings)[0]
        similar_indices = similarities.argsort()[::-1][1:top_n+1]

        similar_movie_ids = [movie_id_mapping[idx] for idx in similar_indices]
        similar_movie_slugs = [recommender.get_movie_name(movie_id) for movie_id in similar_movie_ids]

        return True, similar_movie_slugs
    except:
        return False, None


if __name__ == '__main__':
    # Load CSV
    timer_start = timer()
    # Load Parquet file (much faster than CSV)
    df = pd.read_parquet("data/ratings.parquet", engine='pyarrow')

    print(f"Data loading {timer() - timer_start} seconds")
