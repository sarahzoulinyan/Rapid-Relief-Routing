import networkx as nx
from networkx import MultiDiGraph, shortest_path_length, shortest_path
from create_graph import create_graph
import heapq
from math import *
import random

def nearest_unvisited_node(grf: MultiDiGraph, start, visited):
    # Dijkstra: initialize distances and predecessors
    distances = {node: float('infinity') for node in grf.nodes()}
    # prev[node] will store the previous node along the shortest path
    prev = {node: None for node in grf.nodes()}
    distances[start] = 0
    # Priority queue of (distance, node)
    pq = [(0, start)]

    while pq:
        curr_dist, curr_node = heapq.heappop(pq)
        try:
            curr_node = int(curr_node)
        except:
            pass

        # print(curr_dist, curr_node)

        # If this node is a building and not yet visited, we've found a candidate.
        if (curr_node not in visited) and (grf.nodes[curr_node].get("node_type") == "building"):
            # Reconstruct path from start to curr_node:
            path = []
            node = curr_node
            while node is not None:
                path.append(node)
                node = prev[node]
            # The path is currently from curr_node back to start, so reverse it.
            path.reverse()
            return curr_node, curr_dist, path

        # If we already found a shorter distance to curr_node, skip.
        if curr_dist > distances[curr_node]:
            continue

        for next_node in grf.neighbors(curr_node):
            edge_data = grf.get_edge_data(curr_node, next_node)[0]
            # Assume each edge has a key 'length'

            new_dist = curr_dist + edge_data['length']
            if new_dist < distances[next_node]:
                distances[next_node] = new_dist
                prev[next_node] = curr_node
                try:
                    heapq.heappush(pq, (new_dist, str(next_node)))
                except:
                    # print(new_dist, next_node)
                    pass
    # If no unvisited building is found:
    return None


def get_init_solution(grf: MultiDiGraph, starting_pts):
    """
    Greedy initialization for multi-party TSP.
    starting_pts: list of nodes that serve as initial starting points for separate routes.

    The algorithm works by maintaining one route per starting point.
    At each iteration, the route with the smallest current length is chosen,
    and extended by connecting (via the shortest path) its last node to the nearest unvisited building.
    """
    # Initialize routes and route lengths.
    # routes: dict mapping starting_pt to list of nodes in that route.
    routes = {pt: [pt] for pt in starting_pts}
    pure_routes = {pt: [pt] for pt in starting_pts}
    route_lengths = {pt: 0 for pt in starting_pts}

    # All nodes with node_type "building" that we want to cover.
    building_nodes = {node for node in grf.nodes() if grf.nodes[node].get("node_type") == "building"}
    # Mark starting points as visited.
    visited = set(starting_pts)

    # Continue until all building nodes are visited or no extension is possible.
    while visited != building_nodes:
        # Choose the route with minimal current length.
        best_start = min(route_lengths, key=lambda pt: route_lengths[pt])
        current_route = routes[best_start]
        last_node = current_route[-1]

        # Find the nearest unvisited building from the last node.
        result = nearest_unvisited_node(grf, last_node, visited)
        if result is None:
            # No reachable unvisited building found; break out.
            break
        next_node, dist, sub_path = result
        pure_routes[best_start].append(next_node)
        # sub_path is the shortest path from last_node to next_node.
        # To avoid duplication, remove the first node (which equals last_node).
        extension = sub_path[1:]

        # Extend the chosen route.l
        routes[best_start].extend(extension)
        route_lengths[best_start] += dist

        # Mark all newly added nodes as visited.
        visited.update(extension)

    return routes, route_lengths, pure_routes

def dist(G, a, b):
    try:
        return shortest_path_length(G, source=a, target=b, weight='length')
    except:
        return 1e18


def anneal(G, routes, route_lengths, T):
    """
    Performs one annealing step on a set of routes.
    There are two types of moves:
      1. Intra-route reversal (with probability 0.2)
      2. Node transfer (with probability 0.8)

    The route_lengths dictionary is updated in a delta fashion.
    """

    # --- Intra-route reversal move ---
    if random.random() < 0.2:
        # Choose a random route key.
        route_key = random.choice(list(routes.keys()))
        route = routes[route_key]
        L = len(route)
        # Only proceed if the route has at least 4 nodes (to allow nontrivial reversal while keeping endpoints fixed)
        if L >= 4:
            # Choose indices l and r such that 0 < l < r < L-1.
            l = random.randint(1, L - 3)
            r = random.randint(l + 1, L - 2)

            # For the reversal move, only two edges are affected:
            #   * The edge from route[l-1] to route[l] will be removed.
            #   * The edge from route[r] to route[r+1] will be removed.
            # And they will be replaced by:
            #   * An edge from route[l-1] to route[r].
            #   * An edge from route[l] to route[r+1].
            removed = dist(G, route[l - 1], route[l]) + dist(G, route[r], route[r + 1])
            added = dist(G, route[l - 1], route[r]) + dist(G, route[l], route[r + 1])
            delta = added - removed  # Delta change in the route's length

            # Update: Accept if improvement (delta < 0) or with probability exp(-delta/T)
            if delta < 0 or random.random() < exp(-delta / T):
                # Reverse the subsegment from index l to r.
                routes[route_key][l:r + 1] = routes[route_key][l:r + 1][::-1]
                # Update the stored route length.
                route_lengths[route_key] += delta
                # [Explanation: New length = old length + (added - removed)]
