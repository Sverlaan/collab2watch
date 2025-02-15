# Imports
from letterboxdpy import user
from letterboxdpy import movie
import requests
import time
from model import generate_recommendation

# Keep track of user instances and watchlists
global user_instances
user_instances = {}
user_watchlists = {}
user_ratings = {}
user_seen_movies = {}


def get_movie_data(movie_slug):
    """Get movie data from Letterboxd API"""
    try:
        movie_inst = movie.Movie(movie_slug)

        tagline = movie_inst.tagline
        if tagline is None:
            tagline = ""

        banner = movie_inst.banner
        if banner is None:
            print(f"Using TMDb API to get backdrop for {movie_slug}")
            try:
                banner = get_TMDb_backdrop(movie_inst.tmdb_link)
            except:
                banner = ""

        trailer_obj = movie_inst.trailer
        if trailer_obj is None:
            trailer = ""
        else:
            trailer = trailer_obj['link']

        rating = movie_inst.rating
        if rating is None:
            print(rating)
            rating = -1

        return {"slug": movie_slug,
                "title": movie_inst.title,
                "poster": movie_inst.poster,
                "banner": banner,
                "year": movie_inst.year,
                "description": movie_inst.description,
                "director": ", ".join([director['name'] for director in movie_inst.crew['director']]),
                "rating": rating,
                "runtime": movie_inst.runtime,
                "genres": ", ".join([item['name'] for item in movie_inst.genres if item['type'] == "genre"]),
                "actors": ", ".join([actor['name'] for actor in movie_inst.cast[:3]]),
                "tagline": tagline,
                "tmdb_link": movie_inst.tmdb_link,
                "imdb_link": movie_inst.imdb_link,
                "letterboxd_link": movie_inst.url,
                "trailer": trailer}
    except:
        print("Error in get_movie_data")
        return {"slug": movie_slug, "title": "Error", "poster": "", "banner": "", "year": "", "description": "",
                "director": "", "rating": -1, "runtime": "", "genres": "", "actors": "", "tagline": "",
                "tmdb_link": "", "imdb_link": "", "letterboxd_link": "", "trailer": ""}


def get_TMDb_backdrop(tmdb_link):
    """
    In case the movie banner is not available through the letterboxd scraper, we use TMDb API to retrieve the backdrop
    """
    movie_tmdb_id = tmdb_link[33:-1]

    api_key = "REDACTED"

    time.sleep(0.2)  # Sleep for 0.1 seconds to avoid api rate limit?
    request = f"https://api.themoviedb.org/3/movie/{movie_tmdb_id}?api_key={api_key}"

    r = requests.get(request)
    response = r.json()
    result = response.get('backdrop_path')
    return "https://image.tmdb.org/t/p/original/" + result


def get_user_profile(username):
    """Get user data from Letterboxd API"""
    user_inst = user.User(username)
    user_instances[username] = user_inst

    stats = user_inst.stats
    user_info = {"name": user_inst.display_name,
                 "username": username,
                 "avatar": user_inst.get_avatar()['url'],
                 "num_movies_watched": stats['films'],
                 "watchlist_length": user_inst.watchlist_length,
                 "user_url": user_inst.url}
    return user_info


def initize_user_data(username):
    # Store watchlist
    user_inst = user_instances[username]
    if user_watchlists.get(username) is None:
        user_watchlists[username] = {movie['slug'] for movie in user_inst.get_watchlist()['data'].values()}

    # Store ratings
    if user_ratings.get(username) is None:
        all_user_ratings = {key: value['rating']/2.0 for key, value in user_inst.get_films()['movies'].items() if value['rating'] is not None}
        user_ratings[username] = all_user_ratings
        user_seen_movies[username] = set(all_user_ratings.keys())


def get_user_rating(username, movie_slug):
    """Get user rating for a movie"""
    if user_instances.get(username) is None:
        user_inst = user.User(username)
        user_instances[username] = user_inst
    user_inst = user_instances[username]

    if user_ratings.get(username) is None:
        user_ratings[username] = {key: value['rating']/2.0 for key, value in user_inst.get_films()['movies'].items() if value['rating'] is not None}

    if movie_slug in user_ratings[username]:
        return user_ratings[username][movie_slug]

    return None


def get_rewatch_combo_OLD(username1, username2):
    """Get all movies watched by a user"""
    user_inst = user_instances[username1]

    star_rated_movies5 = set(user_inst.get_films_by_rating(5)['movies'].keys())
    star_rated_movies45 = set(user_inst.get_films_by_rating(4.5)['movies'].keys())
    nstar_rated_movies = star_rated_movies5.union(star_rated_movies45)

    watchlist_other_user = user_watchlists[username2]

    # Get intersection
    common_slugs = nstar_rated_movies.intersection(watchlist_other_user)
    return common_slugs


def get_all_seen_movies(username):
    """Get all movies watched by a user"""
    user_inst = user_instances[username]

    if user_seen_movies.get(username) is not None:
        return user_seen_movies[username]

    all_seen_movies = {movie['slug'] for movie in user_inst.get_films()['movies'].values()}
    user_seen_movies[username] = all_seen_movies
    return all_seen_movies


def get_rewatch_combo(username1, username2):
    """Get all movies watched by a user"""
    user1_inst = user_instances[username1]
    user2_inst = user_instances[username2]

    if user_seen_movies.get(username1) is not None:
        user1_seen_slugs = user_seen_movies[username1]
    else:
        user1_seen_slugs = {movie['slug'] for movie in user1_inst.get_films()['movies'].values()}
        user_seen_movies[username1] = user1_seen_slugs

    if user_seen_movies.get(username2) is not None:
        user2_seen_slugs = user_seen_movies[username2]
    else:
        user2_seen_slugs = {movie['slug'] for movie in user2_inst.get_films()['movies'].values()}
        user_seen_movies[username2] = user2_seen_slugs

    # Get all movies of user2 that user1 has not seen yet
    diff_slugs = list(user1_seen_slugs.difference(user2_seen_slugs))

    # Get predicted ratings for common movies
    preds_user2 = generate_recommendation(username2, diff_slugs, sorted=False)

    # TODO: zip ratings with slugs
    preds = [(slug, preds_user2[i]) for i, slug in enumerate(diff_slugs)]

    # Sort by predicted rating
    preds.sort(key=lambda x: x[1], reverse=True)
    preds = preds

    # Return sorted list of common movies
    return [slug for slug, _ in preds]


def get_common_watchlist(username1, username2):
    """Get common watchlist between two users"""
    user1_inst = user_instances[username1]
    user2_inst = user_instances[username2]

    if user_watchlists.get(username1) is not None:
        user1_watchlist_slugs = user_watchlists[username1]
    else:
        user1_watchlist_slugs = {movie['slug'] for movie in user1_inst.get_watchlist()['data'].values()}
        user_watchlists[username1] = user1_watchlist_slugs

    if user_watchlists.get(username2) is not None:
        user2_watchlist_slugs = user_watchlists[username2]
    else:
        user2_watchlist_slugs = {movie['slug'] for movie in user2_inst.get_watchlist()['data'].values()}
        user_watchlists[username2] = user2_watchlist_slugs

    # Get intersection
    common_slugs = list(user1_watchlist_slugs.intersection(user2_watchlist_slugs))

    # Get predicted ratings for common movies
    preds_user1 = generate_recommendation(username1, common_slugs, sorted=False)
    print(preds_user1)
    preds_user2 = generate_recommendation(username2, common_slugs, sorted=False)
    print(preds_user2)

    preds_avg = [(slug, (preds_user1[i] + preds_user2[i]) / 2.0) for i, slug in enumerate(common_slugs)]
    print(preds_avg)

    # Sort by predicted rating
    preds_avg.sort(key=lambda x: x[1], reverse=True)

    # Return sorted list of common movies
    return [slug for slug, _ in preds_avg]


def get_single_watchlist(username1, username2):
    """Get common watchlist between two users"""
    user1_inst = user_instances[username1]
    user2_inst = user_instances[username2]

    # User 2 seen
    if user_seen_movies.get(username2) is not None:
        user2_seen_slugs = user_seen_movies[username2]
    else:
        user2_seen_slugs = {movie['slug'] for movie in user2_inst.get_films()['movies'].values()}
        user_seen_movies[username2] = user2_seen_slugs

    # User 1 watchlist
    if user_watchlists.get(username1) is not None:
        user1_watchlist_slugs = user_watchlists[username1]
    else:
        user1_watchlist_slugs = {movie['slug'] for movie in user1_inst.get_watchlist()['data'].values()}
        user_watchlists[username1] = user1_watchlist_slugs

    # User 2 watchlist
    if user_watchlists.get(username2) is not None:
        user2_watchlist_slugs = user_watchlists[username2]
    else:
        user2_watchlist_slugs = {movie['slug'] for movie in user2_inst.get_watchlist()['data'].values()}
        user_watchlists[username2] = user2_watchlist_slugs

    # Get all movies of user2 that user1 has not seen yet
    diff_slugs = user1_watchlist_slugs.difference(user2_seen_slugs)
    diff_slugs = diff_slugs.difference(user2_watchlist_slugs)

    # Get predicted ratings for common movies
    preds_user2 = generate_recommendation(username2, diff_slugs, sorted=False)

    # TODO: zip ratings with slugs
    preds = [(slug, preds_user2[i]) for i, slug in enumerate(diff_slugs)]

    # Sort by predicted rating
    preds.sort(key=lambda x: x[1], reverse=True)
    preds = preds
    print(preds)

    # Return sorted list of common movies
    return [slug for slug, _ in preds]


if __name__ == '__main__':
    # Example usage
    print(initize_user_data("sverlaan"))
