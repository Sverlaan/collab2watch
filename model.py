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

    return model, trainset, item_mapping


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


global model, trainset, item_mapping
model, trainset, item_mapping = get_pretrained_model()


def get_similar_movies(movie_slug, top_n=5):

    global model, trainset, item_mapping

    try:
        if model is None or trainset is None or item_mapping is None:
            model, trainset, item_mapping = get_pretrained_model()

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


if __name__ == '__main__':

    print(get_similar_movies("minari"))
    print(get_similar_movies("the-ascent"))
    print(get_similar_movies("the-dark-knight"))
