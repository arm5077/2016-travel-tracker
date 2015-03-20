app = angular.module("travelApp", []);

// Configure $location and set to HTML5 mode
app.config(['$locationProvider', function($locationProvider) {
        $locationProvider.html5Mode({
			enabled: true,
			requireBase: false
		});
    }]);

app.controller("travelController", ["$scope", "$http", "$location", function($scope, $http, $location){
	
	$scope.colors = [
		"#145786",
		"#952226",
		"#B5A99B",
		"#FAA61A",
		"#2B7064"
	];
	
	// Initialize map
	var map = L.map('map').setView([39.8282, -98.5795], 4);
	
	// Change this tilelayer
	L.tileLayer('http://{s}.tiles.mapbox.com/v3/arm5077.78b64076/{z}/{x}/{y}.png', {}).addTo(map);
	
	$scope.parameters = $location.search();
	var queryString = "";
	for( parameter in $scope.parameters) {
		if( $scope.parameters.hasOwnProperty( parameter ) ){
			queryString += ("&" + parameter + "=" + $scope.parameters[parameter].replace(/\//g, '')); 
		}
	}
	
	$http({
		url: "/trips",
		method: "GET",
		params: $scope.parameters
	}).success(function(data, status, headers, config){
		
		// Build new array with candidate as the base
		var candidates = {};
		data.results.forEach(function(trip){
			if( !candidates.hasOwnProperty( trip.candidate ) )
				candidates[trip.candidate] = [];
			candidates[trip.candidate].push(trip);
		});
		
		$scope.candidates = [];
		// Group locations within candidates
		for( name in candidates ){
			if( candidates.hasOwnProperty(name) ){
				candidateObject = { "name": name };
				
				var places = {};
				// Go through each trip...
				candidates[name].forEach(function(trip){
					trip.stops.forEach(function(stop){
						if( !places.hasOwnProperty(stop.placeid) ){
							places[stop.placeid] = stop;
							places[stop.placeid].trips = [];
							places[stop.placeid].count = 0;
						}
						places[stop.placeid].count++;
						trip.stops = "";
						places[stop.placeid].trips.push(trip)
					});
				});
				
				var places_array = [];
				
				for( place in places ){
					if( places.hasOwnProperty(place) ){
						places_array.push(places[place]);
					}
				}
				
				candidateObject["places"] = places_array;
				$scope.candidates.push(candidateObject);;
			
			}
		}
		
		console.log($scope.candidates);
		
		// Loop through candidates
		currentColor = 0
		
		$scope.candidates.forEach(function(candidate){
			if( currentColor < ($scope.colors.length -1) )
				currentColor++;
			else
				currentColor = 0;
				
			candidate.places.forEach(function(place){
				console.log( place.trips.length );
				addMarker([place.lat, place.lng], $scope.colors[currentColor], Math.sqrt( place.trips.length * 700 / Math.PI ));
				
			});
				
		});
		
		/*
		for( name in $scope.candidates ){
			if( $scope.candidates.hasOwnProperty(name) ){
			
				if( currentColor < ($scope.colors.length -1) )
					currentColor++;
				else
					currentColor = 0; 
		
				lastLatLng = [];
		
				// Cycle through trips
				$scope.candidates[name].forEach( function(trip){
					// Loop through stops
					for( i=0; i<=trip.stops.length - 1; i++) {
						
						// If this stop goes nowhere (is at 0,0) let's remove it before it causes MORE trouble
						if( trip.stops[i] == 0 ) {
							trip.stops.splice(i, 1);
							continue;
						}
						
						// If we've just moved from a previous chain, connect to it with a dotted line
						if( lastLatLng.length > 0 ){
							L.polyline([ [trip.stops[i].lat, trip.stops[i].lng], lastLatLng ], {
								color: $scope.colors[currentColor],
								dashArray: "3,10"
							}).addTo(map);
							lastLatLng = [];
						}
						
						// Which stop are we on??
						if( i < trip.stops.length - 1 ){
							L.polyline([ [trip.stops[i].lat, trip.stops[i].lng], [trip.stops[i+1].lat, trip.stops[i+1].lng] ], {
								color: $scope.colors[currentColor]
							}).addTo(map);
							
							
							// Add marker
							addMarker([trip.stops[i].lat, trip.stops[i].lng], $scope.colors[currentColor]);
						
						} else {
							lastLatLng = [trip.stops[i].lat, trip.stops[i].lng];
							
							// If we're on the last stop of the last trip, lay the portrait down
							if( $scope.candidates[name].indexOf(trip) == $scope.candidates[name].length -1 ){
								// Add portrait marker
								L.marker([trip.stops[i].lat, trip.stops[i].lng], {
									icon: L.icon({
										iconUrl: "/assets/walker.png",
										iconSize: [30,30]
									})
								}).addTo(map);
							} else {
								addMarker([trip.stops[i].lat, trip.stops[i].lng], $scope.colors[currentColor]);
							}
						}
					}
				});
			}	
		}*/
	}).error(function(data, status, headers, config){
		throw "Looks like we couldn't get data: " + data;
	});
	
	function addMarker(LatLng, color, radius){
		marker = L.circleMarker(LatLng, {
			fillColor: color,
			fillOpacity: .8,
			weight: 5,
			color: color,
			strokeOpacity:.4,
			radius: radius
		}).addTo(map);
	}
	
}]);