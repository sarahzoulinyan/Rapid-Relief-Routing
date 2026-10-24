# Rapid Relief Routing (Blueprint '25)

Winning project of MIT 2025 Blueprint Hackathon, General Division 

## Inspiration
Natural disasters take the front page of the news constantly. They are relentless, unpredictable, and difficult to manage. In times of crisis, efficient response efforts can mean the difference between life and death. In the most recent LA wildfires, 29 people passed away with countless more experiencing casualties. Inefficient responses to natural crises like these can result in families losing loved ones as well as the destruction that could have been prevented. Witnessing the devastation caused by these tragic events motivated us to create a system that helps emergency services allocate resources effectively to mitigate damage and prioritize safety.

When disaster strikes, responders need a clear strategy to ensure help reaches those in need as quickly as possible. However, the chaotic nature of emergencies often makes real-time decision-making difficult. Our project aims to bridge this gap by optimizing emergency response through a responsive mapping system that enables emergency responders to strategically deploy resources, ensuring faster and more effective aid distribution.


## What it does
Our project provides a dynamic, data-driven, optimal routing system for first-responders to minimize the maximum time it takes to reach a potential victim. To do this, we represent the streetview as a graph: nodes are placed on buildings and road intersections, while edges represent roads and streets. 

To generate our optimal routing system, we formulate this task as a programming problem: Given N starting points, how can we partition the set of building nodes into N routes so that the maximum length of any path is minimized? 

For the N = 1 case, this already reduces to the Traveler’s Salesman Problem, a well-known NP-Hard Problem. This shows that for even small N, this problem is highly nontrivial, and there is definitely a necessity for optimization to ensure that the most lives are saved. 
