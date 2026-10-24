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

    # Compute the projection of the point onto the edge geometry.
    projected_distance = edge_geom.project(point)
    projection_point = edge_geom.interpolate(projected_distance)

    # Create the perpendicular line segment from the point (building centroid) to the projection point.
    perpendicular_line = LineString([point, projection_point])

    # return u, v, key, perpendicular_line, projection_point, edge_geom
    return perpendicular_line, projection_point, u, v


def add_perp(G_combined, building_node_id):
    """
    Given a combined graph (with building nodes added) and a building node ID,
    compute the perpendicular edge to the nearest street edge and add it to the graph.
    """
    # Retrieve the building node's coordinates.
    building_data = G_combined.nodes[building_node_id]
    building_point = Point(building_data['x'], building_data['y'])

    # Find nearest street edge and compute the perpendicular line.
    perp_line, proj_point, u, v = get_closest_perp(G_combined, building_point)

    # Create a new node for the projection point.
    # Use a unique id (e.g., a negative number or use a naming scheme).
    projection_node_id = f"proj_{building_node_id}"
    G_combined.add_node(projection_node_id, x=proj_point.x, y=proj_point.y, node_type='projection')
