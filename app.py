from flask import Flask, render_template, jsonify
from flask_sqlalchemy import SQLAlchemy
from timeit import default_timer as timer
from tqdm import tqdm
import threading
from backend.database import db  # Import db from the separate module
from backend.profile_user import UserProfile
from backend.profile_movie import Movie, get_movie_data
from backend.recommend import MovieRecommender, get_common_watchlist, get_single_watchlist, get_similar_movies, get_rewatchlist, get_recommendations

# Initialize Flask app
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///movies.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize db with the Flask app
db.init_app(app)


@app.route('/')
def home():
    return render_template('index.html')


################ Initialization ################

# Store user profiles
user_profiles = dict()

# Store task statuses
task_status = {1: "pending", 2: "pending", 3: "pending"}

# Store recommender instance
recommender_instance = None


@app.route('/get_user/<string:username>', methods=['GET'])
def get_user(username):
    try:
        start = timer()
        if username in user_profiles:
            user_data = user_profiles[username].to_dict()
        else:
            profile = UserProfile(username)
            user_profiles[username] = profile
            user_data = profile.to_dict()
        # print(f"Time taken: {timer() - start}")

        return jsonify(user_data)
    except:
        return jsonify({"error": "User not found"}), 404


def get_user_data(task_number, usernames):
    """Simulate a task that takes a few seconds"""
    global task_status

    for username in usernames:
        print(f"Initializing {username}")
        start = timer()
        user_inst = user_profiles[username]
        if not user_inst.initialize_complete:
            user_inst.initialize_complete_profile()
        else:
            print(f"{username} already initialized")
        print(f"Time taken: {timer() - start}")

    task_status[task_number] = "complete"  # Mark as complete


def preprocess_data(task_number, usernames, num_samples):
    """Simulate a task that takes a few seconds"""
    global recommender_instance
    global task_status

    if recommender_instance is None:
        recommender_instance = MovieRecommender(data_path="data/ratings.csv")
    recommender_instance.preprocess(usernames, user_profiles, n_samples=int(num_samples))

    task_status[task_number] = "complete"  # Mark as complete


def train_model(task_number, n_factors, n_epochs):
    """Simulate a task that takes a few seconds"""
    global task_status

    if recommender_instance is None:
        task_status[task_number] = "error: recommender not initialized"
        return
    recommender_instance.train_model(n_factors=int(n_factors), n_epochs=int(n_epochs))

    task_status[task_number] = "complete"  # Mark as complete


@app.route("/start_task/<int:task_number>/<string:username1>/<string:username2>/<int:n_samples>/<int:n_factors>/<int:n_epochs>")
def start_task(task_number, username1, username2, n_samples, n_factors, n_epochs):
    """Start a task in a new thread"""
    global task_status
    task_status[task_number] = "running"
    if task_number == 1:
        thread = threading.Thread(target=get_user_data, args=(task_number, [username1, username2]))
    if task_number == 2:
        thread = threading.Thread(target=preprocess_data, args=(task_number, [username1, username2], n_samples))
    if task_number == 3:
        thread = threading.Thread(target=train_model, args=(task_number, n_factors, n_epochs))
    thread.start()
    return jsonify({"message": f"Task {task_number} started"})


@app.route("/get_status/<int:task_number>")
def get_status(task_number):
    """Return the current status of the task"""
    return jsonify({"status": task_status[task_number]})


################ Fetch data for components ################

@app.route('/fetch_movie_data_for_modal/<string:slug>/<string:username1>/<string:username2>', methods=['GET'])
def fetch_movie_data_for_modal(slug, username1, username2):

    # Get movie details
    # print(f"Fetching movie data for {slug} from db")
    start = timer()
    movie = Movie.query.filter_by(slug=slug).first()
    if movie is None:
        raise Exception(f"{slug} not in db. Since this is for opening a modal, this should not happen.")
    movie_data = movie.to_dict()

    pred_1, pred_2 = None, None

    # Get user ratings
    rating_1 = user_profiles[username1].get_rating(slug)
    if rating_1 is not None:
        movie_data["score_1"] = f"{rating_1}"
        movie_data["score_1_color"] = "text-muted"
    else:
        pred_1 = recommender_instance.get_prediction(username1, slug)
        if pred_1 is not None:
            movie_data["score_1"] = f"{round(pred_1 * 20, 1)}%"
            movie_data["score_1_color"] = "text-score"
        else:
            movie_data["score_1"] = "--"
            movie_data["score_1_color"] = "text-muted"

    rating_2 = user_profiles[username2].get_rating(slug)
    if rating_2 is not None:
        movie_data["score_2"] = f"{rating_2}"
        movie_data["score_2_color"] = "text-muted"
    else:
        pred_2 = recommender_instance.get_prediction(username2, slug)
        if pred_2 is not None:
            movie_data["score_2"] = f"{round(pred_2 * 20, 1)}%"
            movie_data["score_2_color"] = "text-score"
        else:
            movie_data["score_2"] = "--"
            movie_data["score_2_color"] = "text-muted"

    if rating_1 is not None and rating_2 is not None:
        movie_data["score_combined"] = str(round((rating_1 + rating_2) / 2.0, 3))
        movie_data["score_combined_color"] = "text-muted"
    elif pred_1 is not None and pred_2 is not None:
        movie_data["score_combined"] = str(round((pred_1 * 20 + pred_2 * 20) / 2.0, 1)) + "%"
        movie_data["score_combined_color"] = "text-score"
    else:
        movie_data["score_combined"] = "--"
        movie_data["score_combined_color"] = "text-muted"

    # print(f"Time taken: {timer() - start}")
    return jsonify(movie_data)


@app.route('/fetch_common_watchlist/<string:username1>/<string:username2>/<string:minRating>/<string:maxRating>/<int:minRuntime>/<int:maxRuntime>/<int:minYear>/<int:maxYear>', methods=['GET'])
def fetch_common_watchlist(username1, username2, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear):

    start = timer()
    slugs = get_common_watchlist(username1, username2, user_profiles, recommender_instance)
    # print(f"Time taken: {timer() - start}")

    return retrieve_movies(slugs, float(minRating), float(maxRating), minRuntime, maxRuntime, minYear, maxYear, top_k=-1)


@app.route('/fetch_single_watchlist/<string:username1>/<string:username2>/<string:minRating>/<string:maxRating>/<int:minRuntime>/<int:maxRuntime>/<int:minYear>/<int:maxYear>', methods=['GET'])
def fetch_single_watchlist(username1, username2, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear):

    start = timer()
    slugs = get_single_watchlist(username1, username2, user_profiles, recommender_instance)
    # print(f"Time taken: {timer() - start}")

    return retrieve_movies(slugs, float(minRating), float(maxRating), minRuntime, maxRuntime, minYear, maxYear, top_k=5)


@app.route('/fetch_rewatchlist/<string:username1>/<string:username2>/<string:minRating>/<string:maxRating>/<int:minRuntime>/<int:maxRuntime>/<int:minYear>/<int:maxYear>', methods=['GET'])
def fetch_rewatchlist(username1, username2, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear):

    start = timer()
    slugs = get_rewatchlist(username1, username2, user_profiles, recommender_instance)
    # print(f"Time taken: {timer() - start}")

    return retrieve_movies(slugs, float(minRating), float(maxRating), minRuntime, maxRuntime, minYear, maxYear, top_k=10)


@app.route('/fetch_recommendations/<string:username1>/<string:username2>/<string:weight>/<string:minRating>/<string:maxRating>/<int:minRuntime>/<int:maxRuntime>/<int:minYear>/<int:maxYear>', methods=['GET'])
def fetch_recommendations(username1, username2, weight, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear):

    start = timer()
    slugs, scores_dict = get_recommendations(username1, username2, int(weight), user_profiles, recommender_instance)
    # print(f"Time taken: {timer() - start}")

    return retrieve_movies(slugs, float(minRating), float(maxRating), minRuntime, maxRuntime, minYear, maxYear, top_k=50, scores=scores_dict)


@app.route('/fetch_similar_movies/<string:slug>/<string:minRating>/<string:maxRating>/<int:minRuntime>/<int:maxRuntime>/<int:minYear>/<int:maxYear>', methods=['GET'])
def fetch_similar_movies(slug, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear):

    start = timer()
    hits, similar_movies = get_similar_movies(slug, recommender_instance, top_n=4)
    if hits == False:
        return jsonify({"error": "Movie ID not in training set"})
    # print(f"Time taken: {timer() - start}")

    return retrieve_movies(similar_movies, top_k=4)


def retrieve_movies(movie_slugs, minRating=0, maxRating=5, minRuntime=0, maxRuntime=9999, minYear=1870, maxYear=2030, top_k=-1, scores=None):

    start = timer()
    for slug in movie_slugs:
        movie = Movie.query.filter_by(slug=slug).first()
        if movie is None:
            print(f"{slug} not in db. Resort to scraping.")
            movie_data = get_movie_data(slug)
            movie = Movie(**movie_data)
            db.session.add(movie)
    db.session.commit()
    # print(f"Time taken: {timer() - start}")

    start = timer()
    retrieved_movies = Movie.query.filter(Movie.rating >= minRating, Movie.rating <= maxRating,
                                          Movie.runtime >= minRuntime, Movie.runtime <= maxRuntime,
                                          Movie.year >= minYear, Movie.year <= maxYear,
                                          Movie.slug.in_(movie_slugs)).all()

    # Sort the retrieved movies in the order of movie_slugs
    movie_dict = {movie.slug: movie.to_dict() for movie in retrieved_movies}
    movies = [movie_dict[slug] for slug in movie_slugs if slug in movie_dict]

    # Add scores if available
    if scores is not None:
        for movie in movies:
            movie["score"] = round(scores[movie["slug"]] * 20, 1)

    movies = movies[:top_k] if top_k != -1 else movies

    # print(f"Time taken: {timer() - start}")

    return jsonify(movies)


def put_movies_in_db(movie_slugs):

    with app.app_context():
        for slug in tqdm(movie_slugs):
            movie = Movie.query.filter_by(slug=slug).first()
            if movie is None:
                movie_data = get_movie_data(slug)
                movie = Movie(**movie_data)
                db.session.add(movie)
        db.session.commit()


if __name__ == '__main__':
    app.run(debug=True)
