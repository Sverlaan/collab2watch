# Imports
from letterboxdpy import user
from letterboxdpy import movie
import requests
import time


class UserProfile:

    def __init__(self, username):
        self.username = username
        self.user_instance = user.User(username)
        self.display_name = self.user_instance.display_name
        self.avatar = self.user_instance.get_avatar()['url'] + '?' + str(time.time())
        self.stats = self.user_instance.stats
        self.num_movies_watched = self.stats['films']
        self.watchlist_length = self.user_instance.watchlist_length
        self.url = self.user_instance.url

        self.watchlist = None
        self.ratings = None
        self.watched = None

    def get_watchlist(self):
        if self.watchlist is None:
            self.watchlist = {movie['slug'] for movie in self.user_instance.get_watchlist()['data'].values()}
        return self.watchlist

    def get_watched(self):
        if self.watched is None:
            self.watched = {slug for slug in self.user_instance.get_films()['movies'].keys()}
        return self.watched

    def get_ratings(self):
        if self.ratings is None:
            all_user_ratings = {key: value['rating']/2.0 for key, value in self.user_instance.get_films()['movies'].items() if value['rating'] is not None}
            self.ratings = all_user_ratings
        return self.ratings

    def get_rating(self, movie_slug):
        if self.ratings is None:
            self.get_ratings()
        if movie_slug in self.ratings:
            return self.ratings[movie_slug]
        return None

    def initialize_complete_profile(self):
        self.get_watchlist()
        self.get_watched()
        self.get_ratings()

    def as_dict(self):
        return {"username": self.username,
                "name": self.display_name,
                "avatar": self.avatar,
                "num_movies_watched": self.num_movies_watched,
                "watchlist_length": self.watchlist_length,
                "url": self.url}

    def __str__(self):
        return f"User: {self.display_name} ({self.username})"


if __name__ == '__main__':
    # Example usage
    usr = UserProfile("sverlaan")
    print(usr)
