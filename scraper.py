# Imports
from letterboxdpy import user
from letterboxdpy import movie
import requests
import time

# Keep track of user instances and watchlists
global user_instances
user_instances = {}
user_watchlists = {}
user_allfilms = {}


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


def get_user_data(username):
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


def get_rewatch_combo(username1, username2):
    """Get all movies watched by a user"""
    user_inst = user_instances[username1]

    if user_allfilms.get(username1) is not None:
        nstar_rated_movies = user_allfilms[username1]
    else:
        star_rated_movies5 = set(user_inst.get_films_by_rating(5)['movies'].keys())
        star_rated_movies45 = set(user_inst.get_films_by_rating(4.5)['movies'].keys())
        nstar_rated_movies = star_rated_movies5.union(star_rated_movies45)
        user_allfilms[username1] = nstar_rated_movies

    watchlist_other_user = user_watchlists[username2]

    # Get intersection
    common_slugs = nstar_rated_movies.intersection(watchlist_other_user)
    return common_slugs


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
    common_slugs = user1_watchlist_slugs.intersection(user2_watchlist_slugs)
    return list(common_slugs)


if __name__ == '__main__':
    # Example usage
    print(get_movie_data("the-ascent"))
