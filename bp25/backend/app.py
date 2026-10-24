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

@app.route('/api/health')
def health_check():
    return jsonify({"status": "healthy"})

@app.route('/api/process-allocation', methods=['POST'])
def process_allocation():
    data = request.json
    
    if not data or 'bbox' not in data:
        return jsonify({"error": "Missing bounding box coordinates"}), 400
    
    try:
        # Extract bounding box coordinates
        bbox = data['bbox']
        location_name = data.get('location_name', 'Unknown location')
        
        # Get fire data if provided
        fires = data.get('fires', [])
        
        graph = create_graph(bbox)
        
        # Remove nodes that are too close to fires
        if fires and len(fires) > 0:
            DANGER_RADIUS = 0.0005
            nodes_to_remove = []
            
            for node_id, node_data in graph.nodes(data=True):
                if 'x' not in node_data or 'y' not in node_data:
                    continue
                    
                for fire in fires:
                    fire_lat = fire.get('latitude')
                    fire_lng = fire.get('longitude')
                    
                    if fire_lat is None or fire_lng is None:
                        continue
                        
                    if isinstance(fire_lat, str):
                        fire_lat = float(fire_lat)
                    if isinstance(fire_lng, str):
                        fire_lng = float(fire_lng)
                    
                    distance = ((node_data['y'] - fire_lat) ** 2 + 
                               (node_data['x'] - fire_lng) ** 2) ** 0.5
                    
                    # If node is too close to any fire, mark for removal
                    if distance < DANGER_RADIUS:
                        nodes_to_remove.append(node_id)
                        break
            
            # Remove the marked nodes from the graph
            for node_id in nodes_to_remove:
                if graph.has_node(node_id):
                    graph.remove_node(node_id)
            
            print(f"Removed {len(nodes_to_remove)} nodes due to proximity to fires")
        
        # Get building nodes for starting points
        building_nodes = [n for n, dat in graph.nodes(data=True) if dat.get('node_type') == 'building']
        
        num_routes = min(5, len(building_nodes))
        if num_routes > 0:
            starting_pts = random.sample(building_nodes, num_routes)
            
            # Get routes using MultiTSP
            routes, pure_routes, route_lengths = get_actual_solution(graph, starting_pts)
            
            routes_converted = {}
            pure_routes_converted = {}
            route_lengths_converted = {}

            for key in routes:
                python_key = float(key) if hasattr(key, 'dtype') else key
                routes_converted[python_key] = routes[key]
                pure_routes_converted[python_key] = pure_routes[key]
                route_lengths_converted[python_key] = route_lengths[key]
