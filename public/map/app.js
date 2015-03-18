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
		$scope.candidates = {};
		data.results.forEach(function(trip){
			if( !$scope.candidates.hasOwnProperty( trip.candidate ) )
				$scope.candidates[trip.candidate] = [];
			$scope.candidates[trip.candidate].push(trip);
		});
		
		// Loop through candidates
		currentColor = 0
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
						
						// Add marker
						L.circleMarker([trip.stops[i].lat, trip.stops[i].lng], {
							fillColor: $scope.colors[currentColor],
							fillOpacity: .8,
							weight: 5,
							color: $scope.colors[currentColor],
							strokeOpacity:.4,
							radius: 10
						} ).addTo(map);
						
						if( lastLatLng.length > 0 ){
							L.polyline([ [trip.stops[i].lat, trip.stops[i].lng], lastLatLng ], {
								color: $scope.colors[currentColor],
								dashArray: "3,10"
							}).addTo(map);
							lastLatLng = [];
						}
						
						if( i < trip.stops.length - 1 ){
							L.polyline([ [trip.stops[i].lat, trip.stops[i].lng], [trip.stops[i+1].lat, trip.stops[i+1].lng] ], {
								color: $scope.colors[currentColor]
							}).addTo(map);
						} else {
							lastLatLng = [trip.stops[i].lat, trip.stops[i].lng];
						}
						
					}
				});
			}	
		}
	}).error(function(data, status, headers, config){
		throw "Looks like we couldn't get data: " + data;
	});
	
}])