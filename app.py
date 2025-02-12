from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from scraper import get_user_profile, get_common_watchlist, get_movie_data, get_rewatch_combo, get_user_rating, initize_user_data
from model import get_similar_movies, get_prediction, init_pretrained_model
from timeit import default_timer as timer
import random
from tqdm import tqdm
import pandas as pd
import threading
import time


app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///movies.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


@app.route('/')
def home():
    return render_template('index.html')


class Movie(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(255), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    year = db.Column(db.Integer, nullable=True)
    description = db.Column(db.Text, nullable=True)
    director = db.Column(db.String(255), nullable=True)
    rating = db.Column(db.Float, nullable=True)
    runtime = db.Column(db.Integer, nullable=True)
    genres = db.Column(db.String(255), nullable=True)
    actors = db.Column(db.String(255), nullable=True)
    tagline = db.Column(db.Text, nullable=True)
    poster = db.Column(db.String(255), nullable=True)
    banner = db.Column(db.String(255), nullable=True)
    tmdb_link = db.Column(db.String(255), nullable=True)
    imdb_link = db.Column(db.String(255), nullable=True)
    letterboxd_link = db.Column(db.String(255), nullable=True)
    trailer = db.Column(db.String(255), nullable=True)

    def to_dict(self):
        return {"id": self.id, "title": self.title, "year": self.year, "description": self.description,
                "director": self.director, "rating": self.rating, "runtime": self.runtime, "genres": self.genres,
                "actors": self.actors, "tagline": self.tagline, "poster": self.poster,
                "banner": self.banner, "slug": self.slug, "tmdb_link": self.tmdb_link, "imdb_link": self.imdb_link,
                "letterboxd_link": self.letterboxd_link, "trailer": self.trailer}


@app.route('/get_user/<string:username>', methods=['GET'])
def get_user(username):

    start = timer()
    print(f"Start scraping user {username} data")
    user_data = get_user_profile(username)
    print(f"Time taken: {timer() - start}")

    if user_data == 404:
        return jsonify({"error": "User not found!"}), 404
    return jsonify(user_data)


# Store task statuses
task_status = {1: "pending", 2: "pending", 3: "pending"}


def init_user_data(task_number, username):
    """Simulate a task that takes a few seconds"""
    global task_status
    initize_user_data(username)
    task_status[task_number] = "complete"  # Mark as complete


def init_model(task_number):
    """Simulate a task that takes a few seconds"""
    global task_status
    init_pretrained_model()
    task_status[task_number] = "complete"  # Mark as complete


@app.route("/start_task/<int:task_number>/<string:username1>/<string:username2>")
def start_task(task_number, username1, username2):
    """Start a task in a new thread"""
    global task_status
    task_status[task_number] = "running"
    if task_number == 1:
        thread = threading.Thread(target=init_user_data, args=(task_number, username1))
    if task_number == 2:
        thread = threading.Thread(target=init_user_data, args=(task_number, username2))
    if task_number == 3:
        thread = threading.Thread(target=init_model, args=(task_number,))
    thread.start()
    return jsonify({"message": f"Task {task_number} started"})


@app.route("/get_status/<int:task_number>")
def get_status(task_number):
    """Return the current status of the task"""
    return jsonify({"status": task_status[task_number]})


@app.route('/fetch_movie_data_for_modal/<string:slug>/<string:username1>/<string:username2>', methods=['GET'])
def fetch_movie_data_for_modal(slug, username1, username2):

    # Get movie details
    print(f"Fetching movie data for {slug} from db")
    start = timer()
    movie = Movie.query.filter_by(slug=slug).first()
    if movie is None:
        raise Exception(f"{slug} not in db. Since this is for opening a modal, this should not happen.")
    movie_data = movie.to_dict()

    pred_1, pred_2 = None, None

    # Get user ratings
    rating_1 = get_user_rating(username1, slug)
    if rating_1 is not None:
        movie_data["score_1"] = f"{rating_1}"
        movie_data["score_1_color"] = f"text-muted"
    else:
        pred_1 = get_prediction(username1, slug)
        if pred_1 is not None:
            movie_data["score_1"] = f"{pred_1}%"
            movie_data["score_1_color"] = f"text-warning"
        else:
            movie_data["score_1"] = "--"
            movie_data["score_1_color"] = "text-muted"

    rating_2 = get_user_rating(username2, slug)
    if rating_2 is not None:
        movie_data["score_2"] = f"{rating_2}"
        movie_data["score_2_color"] = f"text-muted"
    else:
        pred_2 = get_prediction(username2, slug)
        if pred_2 is not None:
            movie_data["score_2"] = f"{pred_2}%"
            movie_data["score_2_color"] = f"text-warning"
        else:
            movie_data["score_2"] = "--"
            movie_data["score_2_color"] = "text-muted"

    if rating_1 is not None and rating_2 is not None:
        movie_data["score_combined"] = str(round((rating_1 + rating_2) / 2.0, 3))
        movie_data["score_combined_color"] = "text-muted"
    elif pred_1 is not None and pred_2 is not None:
        movie_data["score_combined"] = str(int((pred_1 + pred_2) / 2.0)) + "%"
        movie_data["score_combined_color"] = "text-warning"
    else:
        movie_data["score_combined"] = "--"
        movie_data["score_combined_color"] = "text-muted"

    print(f"Time taken: {timer() - start}")
    return jsonify(movie_data)


@app.route('/fetch_common_watchlist/<string:username1>/<string:username2>/<string:minRating>/<string:maxRating>/<int:minRuntime>/<int:maxRuntime>/<int:minYear>/<int:maxYear>', methods=['GET'])
def fetch_common_watchlist(username1, username2, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear):

    minRating = float(minRating)
    maxRating = float(maxRating)

    start = timer()
    print(f"Start collecting watchlist data")
    common_watchlist = get_common_watchlist(username1, username2)
    random.shuffle(common_watchlist)
    print(f"Time taken: {timer() - start}")

    return retrieve_movies(common_watchlist, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear)


@app.route('/fetch_rewatch_combo/<string:username1>/<string:username2>/<string:minRating>/<string:maxRating>/<int:minRuntime>/<int:maxRuntime>/<int:minYear>/<int:maxYear>', methods=['GET'])
def fetch_rewatch_combo(username1, username2, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear):

    minRating = float(minRating)
    maxRating = float(maxRating)

    start = timer()
    print(f"Start collecting all_watched_films data")
    rewatch_combo = get_rewatch_combo(username1, username2)
    print(f"Time taken: {timer() - start}")

    return retrieve_movies(rewatch_combo, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear)


@app.route('/fetch_similar_movies/<string:slug>/<string:minRating>/<string:maxRating>/<int:minRuntime>/<int:maxRuntime>/<int:minYear>/<int:maxYear>', methods=['GET'])
def fetch_similar_movies(slug, minRating, maxRating, minRuntime, maxRuntime, minYear, maxYear):

    print(f"Fetching similar movies for {slug}")
    start = timer()

    hits, similar_movies = get_similar_movies(slug, top_n=4)
    if hits == False:
        return jsonify({"error": "Movie ID not in training set"})

    print(similar_movies)
    print(f"Time taken: {timer() - start}")

    return retrieve_movies(similar_movies, top_k=4)


def retrieve_movies(movie_slugs, minRating=0, maxRating=5, minRuntime=0, maxRuntime=600, minYear=1870, maxYear=2030, top_k=-1):

    start = timer()
    print(f"Start scraping unseen movies' details and adding to db:")
    for slug in movie_slugs:
        movie = Movie.query.filter_by(slug=slug).first()
        if movie is None:
            print(f"{slug}")
            movie_data = get_movie_data(slug)
            movie = Movie(**movie_data)
            db.session.add(movie)
    db.session.commit()
    print(f"Time taken: {timer() - start}")

    start = timer()
    print(f"Start retrieving movie details from database")
    retrieved_movies = Movie.query.filter(Movie.rating >= minRating, Movie.rating <= maxRating,
                                          Movie.runtime >= minRuntime, Movie.runtime <= maxRuntime,
                                          Movie.year >= minYear, Movie.year <= maxYear,
                                          Movie.slug.in_(movie_slugs)).all()

    # Sort the retrieved movies in the order of movie_slugs
    movie_dict = {movie.slug: movie.to_dict() for movie in retrieved_movies}
    movies = [movie_dict[slug] for slug in movie_slugs if slug in movie_dict]
    movies = movies[:top_k] if top_k != -1 else movies

    print(f"Time taken: {timer() - start}")

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
