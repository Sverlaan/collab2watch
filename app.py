from flask import Flask, render_template, jsonify
from timeit import default_timer as timer
from tqdm import tqdm
import threading
from backend.movie import db, Movie, get_movie_data, retrieve_movies
from backend.recommend import MovieRecommender, get_common_watchlist, get_single_watchlist, get_rewatchlist
from backend.user import UserProfile

# Ignore warnings
import warnings
warnings.filterwarnings("ignore")

# Initialize Flask app
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///movies.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize db with the Flask app
db.init_app(app)


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/how')
def how():
    return render_template('how.html')


@app.route('/credits')
def credits():
    return render_template('credits.html')


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


def preprocess_data(task_number, usernames):
    """Simulate a task that takes a few seconds"""
    global recommender_instance
    global task_status

    if recommender_instance is None:
        recommender_instance = MovieRecommender(model_path="model/kernel_mf.pkl")
    recommender_instance.preprocess(usernames, user_profiles)

    task_status[task_number] = "complete"  # Mark as complete


def train_model(task_number):
    """Simulate a task that takes a few seconds"""
    global task_status

    if recommender_instance is None:
        task_status[task_number] = "error: recommender not initialized"
        return
    recommender_instance.train_model()

    task_status[task_number] = "complete"  # Mark as complete


@app.route("/start_task/<int:task_number>/<string:username1>/<string:username2>")
def start_task(task_number, username1, username2):
    """Start a task in a new thread"""
    global task_status
    task_status[task_number] = "running"
    if task_number == 1:
        thread = threading.Thread(target=get_user_data, args=(task_number, [username1, username2]))
    if task_number == 2:
        thread = threading.Thread(target=preprocess_data, args=(task_number, [username1, username2]))
    if task_number == 3:
        thread = threading.Thread(target=train_model, args=(task_number,))
    thread.start()
    return jsonify({"message": f"Task {task_number} started"})


@app.route("/get_status/<int:task_number>")
def get_status(task_number):
    """Return the current status of the task"""
    return jsonify({"status": task_status[task_number]})


################ Fetch data for content ################

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
        pred_1 = recommender_instance.predict_user_rating(username1, slug)
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
        pred_2 = recommender_instance.predict_user_rating(username2, slug)
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

    movies = retrieve_movies(slugs, float(minRating), float(maxRating), minRuntime, maxRuntime, minYear, maxYear, top_k=-1)
    return jsonify(movies)


@app.route('/fetch_single_watchlist/<string:username1>/<string:username2>/<string:minRating>/<string:maxRating>/<int:minRuntime>/<int:maxRuntime>/<int:minYear>/<int:maxYear>', methods=['GET'])
def fetch_single_watchlist(username1, username2, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear):

    start = timer()
    slugs = get_single_watchlist(username1, username2, user_profiles, recommender_instance)
    # print(f"Time taken: {timer() - start}")

    movies = retrieve_movies(slugs, float(minRating), float(maxRating), minRuntime, maxRuntime, minYear, maxYear, top_k=5)
    return jsonify(movies)


@app.route('/fetch_rewatchlist/<string:username1>/<string:username2>/<string:minRating>/<string:maxRating>/<int:minRuntime>/<int:maxRuntime>/<int:minYear>/<int:maxYear>', methods=['GET'])
def fetch_rewatchlist(username1, username2, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear):

    start = timer()
    slugs = get_rewatchlist(username1, username2, user_profiles, recommender_instance)
    # print(f"Time taken: {timer() - start}")

    movies = retrieve_movies(slugs, float(minRating), float(maxRating), minRuntime, maxRuntime, minYear, maxYear, top_k=10)
    return jsonify(movies)


@app.route('/fetch_recommendations/<string:username1>/<string:username2>/<string:weight>/<string:minRating>/<string:maxRating>/<int:minRuntime>/<int:maxRuntime>/<int:minYear>/<int:maxYear>', methods=['GET'])
def fetch_recommendations(username1, username2, weight, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear):

    start = timer()
    slugs, scores_dict = recommender_instance.get_recommendations([username1, username2], int(weight), amount=5000)
    movies = retrieve_movies(slugs, float(minRating), float(maxRating), minRuntime, maxRuntime, minYear, maxYear, top_k=50, scores=scores_dict)
    # print(f"Time taken: {timer() - start}")
    return jsonify(movies)


@app.route('/fetch_similar_movies/<string:slug>/<string:minRating>/<string:maxRating>/<int:minRuntime>/<int:maxRuntime>/<int:minYear>/<int:maxYear>', methods=['GET'])
def fetch_similar_movies(slug, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear):

    start = timer()
    hits, similar_movies = recommender_instance.get_similar_movies(slug, top_n=4)
    if hits == False:
        return jsonify({"success": False, "message": "No similar movies found", "movies": []})  # Return a valid response with a flag
    # print(f"Time taken: {timer() - start}")

    movies = retrieve_movies(similar_movies, top_k=4)

    return jsonify({"success": True, "message": "Similar movies found", "movies": movies})


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
