# Data manipulation
from sklearn.metrics.pairwise import cosine_similarity
import sklearn
import surprise
from surprise import accuracy
from surprise import Reader
from surprise import Dataset
from surprise.model_selection import cross_validate
from surprise.model_selection import GridSearchCV
from surprise import SVD
from surprise.model_selection import train_test_split
import sqlite3
from letterboxdpy import movie
from letterboxdpy import user
import sys
import random
import os
import pickle
import numpy as np
import pandas as pd


def get_pretrained_model():
    with open('model/pre_model.pkl', 'rb') as file:
        model = pickle.load(file)

    with open('model/pre_trainset.pkl', 'rb') as file:
        trainset = pickle.load(file)

    with open('model/pre_item_mapping.pkl', 'rb') as file:
        item_mapping = pickle.load(file)

    with open('model/new_model.pkl', 'rb') as file:
        model = pickle.load(file)

    with open('model/new_trainset.pkl', 'rb') as file:
        trainset = pickle.load(file)

    with open('model/new_item_mapping.pkl', 'rb') as file:
        item_mapping = pickle.load(file)

    with open('model/new_user_mapping.pkl', 'rb') as file:
        user_mapping = pickle.load(file)

    with open('model/new_ratingsdf.pkl', 'rb') as file:
        ratingsdf = pickle.load

    return model, trainset, ratingsdf, item_mapping, user_mapping


def get_movie_id(slug, item_mapping):
    try:
        return item_mapping.tolist().index(slug)
    except:
        return None


def get_movie_name(id, item_mapping):
    try:
        return item_mapping[id]
    except:
        return None


def get_user_id(username, user_mapping):
    try:
        return user_mapping.tolist().index(username)
    except:
        return None


def get_user_name(id, user_mapping):
    try:
        return user_mapping[id]
    except:
        return None


global model, trainset, ratingsdf, item_mapping, user_mapping
model, trainset, ratingsdf, item_mapping, user_mapping = get_pretrained_model()


def get_similar_movies(movie_slug, top_n=5):

    global model, trainset, ratingsdf, item_mapping, user_mapping

    try:
        if model is None or trainset is None or item_mapping is None:
            model, trainset, ratingsdf, item_mapping, user_mapping = get_pretrained_model()

        movie_id = get_movie_id(movie_slug, item_mapping)

        movie_id_mapping = {inner_id: trainset.to_raw_iid(inner_id) for inner_id in trainset.all_items()}

        inner_id = trainset.to_inner_iid(movie_id)

        movie_embeddings = model.qi

        similarities = cosine_similarity([movie_embeddings[inner_id]], movie_embeddings)[0]
        similar_indices = similarities.argsort()[::-1][1:top_n+1]

        similar_movie_ids = [movie_id_mapping[idx] for idx in similar_indices]

        similar_movie_slugs = [get_movie_name(movie_id, item_mapping) for movie_id in similar_movie_ids]

        return True, similar_movie_slugs
    except:
        return False, None


def get_prediction(username, movie_slug):

    global model, trainset, ratingsdf, item_mapping, user_mapping

    if model is None or trainset is None or item_mapping is None or user_mapping is None:
        model, trainset, ratingsdf, item_mapping, user_mapping = get_pretrained_model()

    user_id = get_user_id(username, user_mapping)
    movie_id = get_movie_id(movie_slug, item_mapping)

    if user_id is None or movie_id is None:
        return "TBA"

    prediction = model.predict(user_id, movie_id)
    return int(prediction.est * 20)


def generate_recommendation(username, movie_slugs, n_items=None):
    # movie_ids = ratings_df["movieId"].unique()
    # movie_ids_user = ratings_df.loc[ratings_df["userId"] == user_id, "movieId"]
    # movie_ids_to_pred = np.setdiff1d(movie_ids, movie_ids_user)

    global model, trainset, ratingsdf, item_mapping, user_mapping

    if model is None or trainset is None or item_mapping is None:
        model, trainset, ratingsdf, item_mapping, user_mapping = get_pretrained_model()

    user_id = get_user_id(username, user_mapping)
    movie_ids_to_pred = [get_movie_id(slug, item_mapping) for slug in movie_slugs]

    # Apply a rating of 4 to all interactions (only to match the Surprise dataset format)
    test_set = [[user_id, movie_id, 4] for movie_id in movie_ids_to_pred]

    predictions = model.test(test_set)

    pred_ratings = np.array([pred.est for pred in predictions])

    if n_items is None:
        n_items = len(movie_ids_to_pred)
    index_max = (-pred_ratings).argsort()[:n_items]

    preds = [(get_movie_name(movie_ids_to_pred[i], item_mapping), round(pred_ratings[i], 2)) for i in index_max]
    return preds


if __name__ == '__main__':

    print(generate_recommendation("liannehr", ["minari", "little-miss-sunshine", "solaris"], n_items=5))
