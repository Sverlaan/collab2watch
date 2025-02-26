# Data manipulation
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import pandas as pd
from timeit import default_timer as timer
import pickle
# from user_profile import UserProfile

from matrix_factorization import BaselineModel, KernelMF, train_update_test_split


class MovieRecommender:
    def __init__(self, model_path):
        self.model_path = model_path
        self.model = None
        self.X_update = None
        self.y_update = None
        self.movies_trained_on = None

        self.recs_dict = dict()

    def preprocess(self, usernames, user_profiles):
        """
        Preprocess the data
        """
        timer_start = timer()

        self.model = pickle.load(open(self.model_path, "rb"))
        self.movies_trained_on = {slug for slug in self.model.item_id_map.keys()}
        self.recs_dict = dict()

        # Add ratings from our app users
        new_rows = []
        for username in usernames:
            user_profile = user_profiles[username]
            new_rows.extend([(username, movie_slug, rating) for movie_slug, rating in user_profile.get_ratings().items()])

        # Add blacklist movies
        # new_rows.extend([('liannehr', 'twin-peaks-the-return', 1.0)])

        new_df = pd.DataFrame(new_rows, columns=['user_id', 'item_id', 'rating'])

        self.X_update = new_df[['user_id', 'item_id']]
        self.y_update = new_df['rating']

        print("Update dataset generated in", timer() - timer_start, "seconds")

    def train_model(self, n_epochs=30, lr=0.01):
        """
        Train the model
        """
        timer_start = timer()
        # Update the model
        self.model.update_users(
            self.X_update, self.y_update, lr=lr, n_epochs=n_epochs, verbose=0
        )
        print(f"Retraining took {timer() - timer_start} seconds")

    def predict_user_rating(self, username, movie_slug):
        """
        Get the predicted user rating for a specific movie
        """
        # Check if movie is in the model
        if movie_slug not in self.model.item_id_map:
            return None

        # Create dataframe of user and movie
        df_to_pred = pd.DataFrame([[username, movie_slug]], columns=["user_id", "item_id"])

        prediction = self.model.predict(df_to_pred)
        return prediction[0]

    def get_predictions(self, username, movie_slugs, sorted=True, n_items=None):
        """
        Get the predicted user ratings for a list of movies
        """
        movie_slugs = list(movie_slugs)

        # Create dataframe of user and movie
        df_to_pred = pd.DataFrame([[username, movie_slug] for movie_slug in movie_slugs], columns=["user_id", "item_id"])
        pred_ratings = self.model.predict(df_to_pred)

        if not sorted:
            return pred_ratings

        # Combine slugs and ratings
        preds = [(movie_slugs[i], pred_ratings[i]) for i in range(len(movie_slugs))]

        # Sort by predicted rating
        preds.sort(key=lambda x: x[1], reverse=True)
        return preds

    def get_recommendations(self, usernames, weight=-1, amount=10):
        """
        Get recommendations based on two users
        """

        def repack(df):
            """
            Convert dataframe to list of slugs and dictionary of scores
            """
            slugs = df["item_id"].tolist()
            scores = {slug: score for slug, score in zip(slugs, df["rating_pred"])}
            return slugs, scores

        for username in usernames:
            if username not in self.recs_dict:
                items_known = self.X_update.query("user_id == @username")["item_id"]
                self.recs_dict[username] = self.model.recommend(user=username, items_known=items_known, amount=amount)

        if weight == -1:
            return repack(self.recs_dict[usernames[0]].drop(columns=["user_id"]))
        elif weight == 1:
            return repack(self.recs_dict[usernames[1]].drop(columns=["user_id"]))
        else:
            recs1 = self.recs_dict[usernames[0]]
            recs2 = self.recs_dict[usernames[1]]
            # Merge on item_id
            merged = recs1.merge(recs2, on="item_id", suffixes=("_1", "_2"))
            # Compute average rating
            merged["rating_pred"] = (merged["rating_pred_1"] + merged["rating_pred_2"]) / 2
            # Select required columns
            recs12 = merged[["item_id", "rating_pred"]]
            # Sort by rating_pred in descending order
            recs12 = recs12.sort_values(by="rating_pred", ascending=False).reset_index(drop=True)
            return repack(recs12)

    def get_similar_movies(self, movie_slug, top_n=5):
        """
        Get similar movies to a given movie
        """
        try:
            embs = self.model.item_features
            items = list(self.model.item_id_map.keys())
            movie_index = self.model.item_id_map.get(movie_slug)

            # Compute cosine similarity
            movie_emb = embs[movie_index].reshape(1, -1)
            similarities = cosine_similarity(movie_emb, embs)[0]

            # Sort and get top N
            similar_indices = np.argsort(similarities)[::-1]
            similar_indices = [i for i in similar_indices if i != movie_index]
            similar_indices = similar_indices[:top_n]
            similar_slugs = [items[i] for i in similar_indices]

            return True, similar_slugs
        except:
            return False, None


def get_common_watchlist(username1, username2, user_profiles, recommender):
    """
    Get common watchlist between two users
    """
    user1_watchlist = user_profiles[username1].get_watchlist()
    user2_watchlist = user_profiles[username2].get_watchlist()

    # Get intersection
    common_slugs = list(user1_watchlist.intersection(user2_watchlist))

    # Get predicted ratings for common movies
    preds_user1 = recommender.get_predictions(username1, common_slugs, sorted=False)
    preds_user2 = recommender.get_predictions(username2, common_slugs, sorted=False)

    preds_avg = [(slug, (preds_user1[i] + preds_user2[i]) / 2.0) for i, slug in enumerate(common_slugs)]

    # Sort by predicted rating
    preds_avg.sort(key=lambda x: x[1], reverse=True)

    # # Add movies that are not in the model to the end of the list
    # preds_avg.extend([(slug, None) for slug in common_slugs_not_in_model])

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

    # Only get the slugs that are in the model
    diff_slugs = [slug for slug in diff_slugs if slug in recommender.movies_trained_on]

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

    # Only get the slugs that are in the model
    diff_slugs = [slug for slug in diff_slugs if slug in recommender.movies_trained_on]

    # Get predicted ratings for common movies
    preds_user2 = recommender.get_predictions(username2, diff_slugs, sorted=False)

    preds = [(slug, preds_user2[i]) for i, slug in enumerate(diff_slugs)]

    # Sort by predicted rating
    preds.sort(key=lambda x: x[1], reverse=True)

    # Return sorted list of common movies
    return [slug for slug, _ in preds]


# if __name__ == '__main__':

    # user_profiles = {
    #     "liannehr": UserProfile("liannehr")
    # }

    # recommender = MovieRecommender(model_path="model/kernelmf.pkl")
    # recommender.preprocess(["liannehr"], user_profiles)
    # recommender.train_model(n_epochs=30, lr=0.001)

    # print(get_similar_movies("kikis-delivery-service", recommender))

    # Get recommendations
    # user_test = 'liannehr'
    # items_known = recommender.X_update.query("user_id == @user_test")["item_id"]
    # recs = recommender.model.recommend(user=user_test, items_known=items_known, amount=10)
    # print(recs)

    # res = recommender.get_recommendations("liannehr", "sverlaan", 0, user_profiles, recommender)
    # print(res)

    # Get predictions
    # print(recommender.get_prediction("liannehr", ["twin-peaks-the-return", "portrait-of-a-lady-on-fire"]))
    # print(recommender.get_prediction("liannehr", "portrait-of-a-lady-on-fire"))
