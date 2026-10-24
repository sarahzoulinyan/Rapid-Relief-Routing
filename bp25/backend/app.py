from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

try:
    from create_graph import create_graph
    from MultiTSP import get_actual_solution
except ImportError:
    from bp25.backend.create_graph import create_graph
    from bp25.backend.MultiTSP import get_actual_solution

import networkx as nx
import random
import osmnx as ox

app = Flask(__name__)
CORS(app)
