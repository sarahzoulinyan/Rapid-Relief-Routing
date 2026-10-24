import React, { useState, useEffect, useRef } from 'react';
import { ChakraProvider, Box, Input, Button, Heading, Text, VStack, Container, Spinner, Flex, List, ListItem } from '@chakra-ui/react';
import { defaultSystem } from "@chakra-ui/react";
import { MapContainer, TileLayer, Marker, Popup, Rectangle, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';
import Papa from 'papaparse';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_BASE_URL = 'http://localhost:5000';

const FIXED_BOX_SIZE_PERCENT = 60;

function FixedBoundingBox({ onBoundsChange }: { onBoundsChange: (bounds: [[number, number], [number, number]]) => void }) {
  const map = useMap();
  const [bounds, setBounds] = useState<[[number, number], [number, number]] | null>(null);
  
  useMapEvents({
    moveend: () => {
      updateBounds();
    },
    zoomend: () => {
      updateBounds();
    },
    resize: () => {
      updateBounds();
    }
  });
  
  // Calculate the fixed bounding box in the center of the map
  const updateBounds = () => {
    const center = map.getCenter();
    const bounds = map.getBounds();
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    
    const latDiff = northEast.lat - southWest.lat;
    const lngDiff = northEast.lng - southWest.lng;
    
    const boxSize = Math.min(
      latDiff * (FIXED_BOX_SIZE_PERCENT / 100),
      lngDiff * (FIXED_BOX_SIZE_PERCENT / 100)
    );
    
    const fixedBounds: [[number, number], [number, number]] = [
      [center.lat - boxSize/2, center.lng - boxSize/2],
      [center.lat + boxSize/2, center.lng + boxSize/2]
    ];
    
    setBounds(fixedBounds);
    onBoundsChange(fixedBounds);
  };
  
  useEffect(() => {
    if (map) {
      updateBounds();
    }
  }, [map]);
  
  return bounds ? (
    <Rectangle 
      bounds={bounds}
      pathOptions={{ color: 'red', weight: 2, fillOpacity: 0.1 }}
    />
  ) : null;
}

function GraphVisualization({ graphData, fires }: { graphData: any, fires?: any[] }) {
  const map = useMap();
  const legendControlRef = useRef<L.Control | null>(null);
  
  useEffect(() => {
    if (!graphData || !graphData.nodes || !graphData.edges) return;
    
    map.eachLayer((layer) => {
      if ((layer instanceof L.Polyline && !(layer instanceof L.Rectangle)) || 
          (layer instanceof L.CircleMarker)) {
        map.removeLayer(layer);
      }
    });
    
    if (legendControlRef.current) {
      map.removeControl(legendControlRef.current);
      legendControlRef.current = null;
    }
    
    const nodeMarkers: {[key: string]: L.CircleMarker} = {};
    graphData.nodes.forEach((node: any) => {
      let color;
      if (node.route_color) {
        color = node.route_color;
      } else {
        color = node.type === 'building' ? 'blue' : 
                node.type === 'projection' ? 'green' : '#333';
      }
      
      const radius = node.type === 'building' ? 4 : 
                    node.type === 'projection' ? 2.5 : 3;
      
      const weight = node.type === 'street' ? 1.5 : 1;
      
      const marker = L.circleMarker([node.lat, node.lng], {
        radius: radius,
        fillColor: color,
        color: color,
        weight: weight,
        opacity: 0.9,
        fillOpacity: 0.8
      }).addTo(map);
      
      if (node.route_id) {
        marker.bindPopup(`Node: ${node.id}<br>Type: ${node.type}<br>Route: ${node.route_id}`);
      } else {
        marker.bindPopup(`Node: ${node.id}<br>Type: ${node.type}`);
      }
      
      nodeMarkers[node.id] = marker;
    });
    
    graphData.edges.forEach((edge: any) => {
      const sourceNode = graphData.nodes.find((n: any) => n.id === edge.source);
      const targetNode = graphData.nodes.find((n: any) => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        let color;
        if (edge.route_color) {
          color = edge.route_color;
          color = edge.route_color;
        } else {
          color = edge.type === 'perpendicular' ? '#800080' : '#444';
        }
        
        const weight = edge.type === 'perpendicular' ? 2 : 1.5;
        
        L.polyline([[sourceNode.lat, sourceNode.lng], [targetNode.lat, targetNode.lng]], {
          color: color,
          weight: weight,
          opacity: 0.85
        }).addTo(map);
      }
    });
    
    if (graphData.routes && graphData.routes.length > 0) {
      const legendControl = new L.Control({ position: 'bottomright' });
      
      legendControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.backgroundColor = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
        
        div.innerHTML = '<h4 style="margin:0 0 5px 0">Legend</h4>';
        
        div.innerHTML += '<div style="margin-bottom:5px;"><strong>Node Types:</strong></div>';
        div.innerHTML += '<div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:blue;margin-right:5px;"></span>Building</div>';
        div.innerHTML += '<div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:green;margin-right:5px;"></span>Projection</div>';
        div.innerHTML += '<div><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#333;margin-right:5px;"></span>Street</div>';
        
        div.innerHTML += '<div style="margin:5px 0;"><strong>Edge Types:</strong></div>';
        div.innerHTML += '<div><span style="display:inline-block;width:12px;height:2px;background:#800080;margin-right:5px;"></span>Building-to-street</div>';
        div.innerHTML += '<div><span style="display:inline-block;width:12px;height:2px;background:#444;margin-right:5px;"></span>Street network</div>';
        
        if (graphData.routes && graphData.routes.length > 0) {
          div.innerHTML += '<div style="margin:5px 0;"><strong>Routes:</strong></div>';
          graphData.routes.forEach((route: any) => {
            div.innerHTML += `<div><span style="display:inline-block;width:12px;height:12px;background:${route.color};margin-right:5px;"></span>Route ${route.display_id} (${route.length} nodes)</div>`;
          });
        }
        
        if (graphData.fire_stations && graphData.fire_stations.length > 0) {
          div.innerHTML += '<div style="margin:5px 0;"><strong>Facilities:</strong></div>';
          div.innerHTML += '<div><span style="display:inline-block;width:12px;height:12px;background:red;margin-right:5px;"></span>Fire Station</div>';
        }
        

        if (fires && fires.length > 0) {
          div.innerHTML += '<div style="margin:5px 0;"><strong>Active Fires:</strong></div>';
          div.innerHTML += `<div>
            <span style="
              display: inline-block;
              width: 16px;
              height: 16px;
              background-color: #ff0000;
              border-radius: 50%;
              margin-right: 5px;
              position: relative;
            ">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="10" height="10" fill="white" style="position: absolute; top: 3px; left: 3px;">
                <path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z"/>
              </svg>
            </span>
            Active Fire
          </div>`;
        }
        
        return div;
      };
      
      legendControl.addTo(map);
      legendControlRef.current = legendControl;
    }
    
    return () => {
      if (legendControlRef.current) {
        map.removeControl(legendControlRef.current);
      }
    };
    
  }, [map, graphData, fires]);
  
  return null;
}

function FireStationMarkers({ stations }: { stations: any[] }) {
  const fireIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  return (
    <>
      {stations.map(station => (
        <Marker 
          key={station.id} 
          position={[station.lat, station.lng]} 
          icon={fireIcon}
        >
          <Popup>
            <div>
              <strong>{station.name}</strong>
              <div>Fire Station</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function FireMarkers({ fires }: { fires: any[] }) {
  console.log("Rendering FireMarkers with fires:", fires);
  
  const fireIcon = new L.DivIcon({
    html: `<div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      background-color: rgba(255, 0, 0, 0.7);
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
    ">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="16" height="16" fill="white">
        <path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z"/>
      </svg>
    </div>`,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });

  return (
    <>
      {fires.map((fire, index) => {
        // Ensure latitude and longitude are numbers
        const lat = typeof fire.latitude === 'number' ? fire.latitude : parseFloat(fire.latitude);
        const lng = typeof fire.longitude === 'number' ? fire.longitude : parseFloat(fire.longitude);
        
        console.log(`Fire ${index}: lat=${lat}, lng=${lng}`);
        
        return (
          <Marker 
            key={`fire-${index}`} 
            position={[lat, lng]} 
            icon={fireIcon}
          >
            <Popup>
              <div>
                <strong>Active Fire</strong>
                <div>Date: {fire.acq_date}</div>
                <div>Time: {fire.acq_time}</div>
                <div>Satellite: {fire.satellite}</div>
                <div>Confidence: {fire.confidence}</div>
                <div>Time of day: {fire.daynight === 'D' ? 'Day' : 'Night'}</div>
                {fire.risk_score && (
                  <div>Risk Score: {fire.risk_score}</div>
                )}
                {fire.census_tract && (
                  <div>Census Tract: {fire.census_tract}</div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function parseCSV(csvText: string) {
  if (!csvText || csvText.trim() === '') {
    console.log("Empty CSV text");
    return [];
  }
  
  const lines = csvText.trim().split('\n');
  if (lines.length <= 1) {
    console.log("CSV has only header or is empty");
    return [];
  }
  
  const headers = lines[0].split(',');
  console.log("CSV headers:", headers);
  
  const result = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',');
    if (values.length !== headers.length) {
      console.warn(`Line ${i} has ${values.length} values but headers has ${headers.length}`);
      continue;
    }
    
    const obj: {[key: string]: any} = {};
    
    headers.forEach((header, index) => {
      const value = values[index];
      // Try to convert to number if possible
      obj[header] = !isNaN(Number(value)) ? Number(value) : value;
    });
    
    // Ensure latitude and longitude exist and are valid
    if (obj.latitude !== undefined && obj.longitude !== undefined) {
      result.push(obj);
    } else {
      console.warn("Missing latitude or longitude in CSV row:", obj);
    }
  }
  
  console.log("Parsed CSV data:", result);
  return result;
}

async function findHighestRiskLocation(lat: number, lng: number, radius: number = 0.2) {
  try {
    const nriDataPath = '/data/NRI_Table_CensusTracts.csv';
    console.log("Attempting to load NRI data from:", nriDataPath);
    
    const checkResponse = await fetch(nriDataPath, { method: 'HEAD' });
    if (!checkResponse.ok) {
      throw new Error(`CSV file not found: ${checkResponse.status} ${checkResponse.statusText}`);
    }
    
    const response = await fetch(nriDataPath);
    if (!response.ok) {
      throw new Error(`Failed to load CSV: ${response.status}`);
    }
    
    const csvText = await response.text();
    
    if (csvText.trim().startsWith('<!DOCTYPE html>')) {
      throw new Error("Received HTML instead of CSV data");
    }
    
    const results = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true
    });
    
    const validLocations = results.data.filter((location: any) => {
      const hasLatitude = location.LATITUDE && !isNaN(parseFloat(location.LATITUDE));
      const hasLongitude = location.LONGITUDE && !isNaN(parseFloat(location.LONGITUDE));
      const hasRiskScore = location.RISK_SCORE && !isNaN(parseFloat(location.RISK_SCORE));
      
      return hasLatitude && hasLongitude && hasRiskScore;
    });
    
    // Try with a very large radius to find any locations
    const veryLargeRadius = 20;
    const anyLocations = validLocations.filter((location: any) => {
      const locationLat = parseFloat(location.LATITUDE);
      const locationLng = parseFloat(location.LONGITUDE);
      
      const distance = Math.sqrt(
        Math.pow(locationLat - lat, 2) + 
        Math.pow(locationLng - lng, 2)
      );
      
      return distance <= veryLargeRadius;
    });
    
    if (anyLocations.length > 0) {
      // Find the location with the highest risk score
      const highestRiskLocation = anyLocations.reduce((prev: any, current: any) => {
        return parseFloat(prev.RISK_SCORE) > parseFloat(current.RISK_SCORE) ? prev : current;
      });
      
      console.log("Using highest risk location from very large radius:", highestRiskLocation);
      return highestRiskLocation;
    }
    
    throw new Error("No locations found in the dataset");
    
  } catch (error) {
    console.error("Error loading or parsing CSV:", error);
    
    // NRI data taken specifically for Pacific Palisades area
    const sampleNRIData = [
      {
        CENSUS_TRACT_ID: "06037702200",
        LATITUDE: "34.0455",
        LONGITUDE: "-118.5260",
        RISK_SCORE: "78.92",
        COUNTY: "Los Angeles County",
        STATE: "California"
      },
      {
        CENSUS_TRACT_ID: "06037702100",
        LATITUDE: "34.0522",
        LONGITUDE: "-118.5437",
        RISK_SCORE: "82.37",
        COUNTY: "Los Angeles County",
        STATE: "California"
      },
      {
        CENSUS_TRACT_ID: "06037702300",
        LATITUDE: "34.0389",
        LONGITUDE: "-118.5195",
        RISK_SCORE: "75.21",
        COUNTY: "Los Angeles County",
        STATE: "California"
      },
      {
        CENSUS_TRACT_ID: "06037702000",
        LATITUDE: "34.0592",
        LONGITUDE: "-118.5314",
        RISK_SCORE: "79.75",
        COUNTY: "Los Angeles County",
        STATE: "California"
      },
      {
        CENSUS_TRACT_ID: "06037702400",
        LATITUDE: "34.0325",
        LONGITUDE: "-118.5104",
        RISK_SCORE: "76.18",
        COUNTY: "Los Angeles County",
        STATE: "California"
      }
    ];
    
    const nearbyLocations = sampleNRIData.filter((location) => {
      const locationLat = parseFloat(location.LATITUDE);
      const locationLng = parseFloat(location.LONGITUDE);
      
      const distance = Math.sqrt(
        Math.pow(locationLat - lat, 2) + 
        Math.pow(locationLng - lng, 2)
      );
      
      return distance <= radius;
    });
    
    if (nearbyLocations.length === 0) {
      const largerRadius = radius * 5;
      const farLocations = sampleNRIData.filter((location) => {
        const locationLat = parseFloat(location.LATITUDE);
        const locationLng = parseFloat(location.LONGITUDE);
        
        const distance = Math.sqrt(
          Math.pow(locationLat - lat, 2) + 
          Math.pow(locationLng - lng, 2)
        );
        
        return distance <= largerRadius;
      });
      
      if (farLocations.length > 0) {
        // Find the location with the highest risk score
        const highestRiskLocation = farLocations.reduce((prev, current) => {
          return parseFloat(prev.RISK_SCORE) > parseFloat(current.RISK_SCORE) ? prev : current;
        });
        
        return highestRiskLocation;
      }
      
      return null;
    }
    
    // Find the location with the highest risk score
    const highestRiskLocation = nearbyLocations.reduce((prev, current) => {
      return parseFloat(prev.RISK_SCORE) > parseFloat(current.RISK_SCORE) ? prev : current;
    });
    
    return highestRiskLocation;
  }
}

function AboutPage({ onClose }: { onClose: () => void }) {
  return (
    <Box
      position="fixed"
      top="0"
      left="0"
      right="0"
      bottom="0"
      bg="rgba(0,0,0,0.7)"
      zIndex={1000}
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
      onClick={onClose}
    >
      <Box
        bg="white"
        borderRadius="lg"
        p={8}
        maxWidth="800px"
        maxHeight="90vh"
        overflowY="auto"
        onClick={(e) => e.stopPropagation()}
        boxShadow="xl"
      >
        <Heading as="h2" size="xl" mb={6} color="teal.600" textAlign="center">
          About Dispatch Services
        </Heading>
        
        <Text fontSize="lg" mb={6} lineHeight="tall">
          Natural disasters take the front page of the news constantly. They are relentless, unpredictable, and difficult to manage. 
          In times of crisis, efficient response efforts can mean the difference between life and death. In the most recent LA wildfires, 
          29 people passed away with countless more experiencing casualties. Inefficient responses to natural crises like these can result 
          in families losing loved ones as well as the destruction that could have been prevented. Witnessing the devastation caused by 
          these tragic events motivated us to create a system that helps emergency services allocate resources effectively to mitigate 
          damage and prioritize safety.
        </Text>
        
        <Text fontSize="lg" mb={8} lineHeight="tall">
          When disaster strikes, responders need a clear strategy to ensure help reaches those in need as quickly as possible. 
          However, the chaotic nature of emergencies often makes real-time decision-making difficult. Our project aims to bridge 
          this gap by optimizing emergency response through a responsive mapping system that enables emergency responders to 
          strategically deploy resources, ensuring faster and more effective aid distribution.
        </Text>
        
        <Flex justifyContent="center">
          <Button colorScheme="teal" size="lg" onClick={onClose}>
            Close
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}

function MethodologyPage({ onClose }: { onClose: () => void }) {
  return (
    <Box
      position="fixed"
      top="0"
      left="0"
      right="0"
      bottom="0"
      bg="rgba(0,0,0,0.7)"
      zIndex={1000}
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
      onClick={onClose}
    >
      <Box
        bg="white"
        borderRadius="lg"
        p={8}
        maxWidth="800px"
        maxHeight="90vh"
        overflowY="auto"
        onClick={(e) => e.stopPropagation()}
        boxShadow="xl"
      >
        <Heading as="h2" size="xl" mb={6} color="teal.600" textAlign="center">
          Our Methodology
        </Heading>
        
        <Text fontSize="lg" mb={4} lineHeight="tall">
          Our project provides a dynamic, data-driven, optimal routing system for first-responders to minimize the maximum time it takes to reach a potential victim. To do this, we represent the streetview as a graph: nodes are placed on buildings and road intersections, while edges represent roads and streets.
        </Text>
        
        <Text fontSize="lg" mb={4} lineHeight="tall">
          To generate our optimal routing system, we formulate this task as a programming problem: Given N starting points, how can we partition the set of building nodes into N routes so that the maximum length of any path is minimized?
        </Text>
        
        <Text fontSize="lg" mb={4} lineHeight="tall">
          For the N = 1 case, this already reduces to the Traveler's Salesman Problem, a well-known NP-Hard Problem. This shows that for even small N, this problem is highly nontrivial, and there is definitely a necessity for optimization to ensure that the most lives are saved.
        </Text>
        
        <Text fontSize="lg" mb={4} lineHeight="tall">
          To solve this in the general case, we use a technique known as Simulated Annealing which takes a base solution and performs localized operations. These localized operations induce a change or "entropy" in how good the solution is. We always accept better solutions, but we also accept worse solutions with a probability that decreases over time (this variable is controlled through a "Temperature").
        </Text>
        
        <Text fontSize="lg" mb={4} lineHeight="tall">
          To be more precise, we account for three "localized operations" that we can perform on an existing solution:
        </Text>
        
        <List.Root pl={8} mb={4}>
          <ListItem>Range Reversal on an arbitrary subarray of locations in a route</ListItem>
          <ListItem>Removing and replacing a location from one route into another</ListItem>
          <ListItem>Removing and replacing a location in a route within itself</ListItem>
        </List.Root>
        
        <Text fontSize="lg" mb={4} lineHeight="tall">
          To obtain a sufficiently optimal base solution, we code a custom greedy algorithm. At each time step, we take the current path with the minimum length, use a Dijkstra-esque BFS to find the closest unvisited building, and traverse to that building. After we generate this solution, we further optimize upon it with the aforementioned simulated annealing. We find that on average, simulated annealing reduces the maximum path length generated by the greedy algorithm by a staggering 10.9%, showing the efficacy of the algorithm at saving lives.
        </Text>
        
        <Text fontSize="lg" mb={4} lineHeight="tall">
          Although this static approach is good, fires and other natural disasters are extremely dynamic environments, with roads suddenly becoming inaccessible. To account for this, every time our graph is updated with new information, we run a mini simulated annealing (i.e. re-raising the temperature slightly) to let the routing converge to a new local minimum efficiently.
        </Text>
        
        <Text fontSize="lg" mb={4} lineHeight="tall">
          In fire-affected areas, nodes within the impacted radius are automatically removed, ensuring teams avoid hazardous zones and focus their efforts on reachable locations. This allows for real-time adaptability to changing disaster conditions, improving safety and efficiency.
        </Text>
        
        <Text fontSize="lg" mb={4} lineHeight="tall">
          Additionally, responders can manually delete nodes and edges, updating the map to reflect roadblocks, damaged structures, or newly accessible paths. This level of customization ensures that emergency teams can quickly adjust their strategies, responding with greater precision.
        </Text>
        
        <Text fontSize="lg" mb={6} lineHeight="tall">
          By integrating these features, our system enhances emergency response efforts in order to maximize the impact of relief operations.
        </Text>
        
        <Flex justifyContent="center">
          <Button colorScheme="teal" size="lg" onClick={onClose}>
            Close
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}
