# Imports
from letterboxdpy import user
from letterboxdpy import movie
import requests
import time


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
