import osmnx as ox
import networkx as nx
import geopandas as gpd
import matplotlib.pyplot as plt
from shapely.geometry import Point, LineString
from scipy.spatial import cKDTree
import warnings

# Suppress specific runtime warnings from Shapely
warnings.filterwarnings("ignore", category=RuntimeWarning, module="shapely")

def get_closest_perp(G, point):
    """
    Given a graph G and a shapely Point, find the nearest edge to the point,
    compute the projection of the point onto that edge, and return the line (as a LineString)
    connecting the point to its projection on the edge.
    """
    # Get the nearest edge (u, v, key) to the point using OSMnx's built-in function.
    u, v, key = ox.distance.nearest_edges(G, point.x, point.y)

    # Retrieve the edge geometry. If the edge has no geometry attribute, create a LineString from node coordinates.
    edge_data = G.edges[u, v, key]
    if 'geometry' in edge_data:
        edge_geom = edge_data['geometry']
    else:
        point_u = Point(G.nodes[u]['x'], G.nodes[u]['y'])
        point_v = Point(G.nodes[v]['x'], G.nodes[v]['y'])
        edge_geom = LineString([point_u, point_v])
