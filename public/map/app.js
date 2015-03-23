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
	
	$scope.moment = moment;
	
	// Initialize map
	var map = L.map('map', {
		maxZoom: 7,
		minZoom: 4
	}).setView([39.8282, -98.5795], 4);

	// Throw in my custom baselayer
		L.tileLayer('http://{s}.tiles.mapbox.com/v3/arm5077.78b64076/{z}/{x}/{y}.png', {}).addTo(map);
	
	// Add targeting reticule
		var target = L.circleMarker([0,0], {
			stroke: true,
			color: "red",
			fill: false,
			dashArray: "2,5",
			radius: 50,
			opacity: 0
		}).addTo(map);
	
	// Pull in parameters and make API request
	$scope.parameters = $location.search();
	$http({
		url: "/trips",
		method: "GET",
		params: $scope.parameters
	}).success(function(data, status, headers, config){
				
		$scope.params = data.params;
		
		$scope.params.start = $scope.params.start || "2014-01-01";
		$scope.params.start = new Date( $scope.params.start );
		$scope.params.end = $scope.params.end || new Date();
		$scope.params.end = new Date( $scope.params.end );
		
		console.log($scope.params);
		
		$scope.data = data.results;
		
		// Build new array with candidate as the base
		$scope.candidates = {};
		data.results.forEach(function(trip){
			if( !$scope.candidates.hasOwnProperty( trip.candidate ) )
				$scope.candidates[trip.candidate] = [];
			$scope.candidates[trip.candidate].push(trip);
		});
		
		var currentColor = 0;
		var markers = new L.MarkerClusterGroup({
			maxClusterRadius: 40,
			spiderfyDistanceMultiplier: 3,
			showCoverageOnHover: false,
			iconCreateFunction: function(cluster){
				rawClusterColors = cluster.getAllChildMarkers().map(function(marker){ return marker.options.color })
				clusterColors = [];
				unique = {};
				rawClusterColors.forEach(function(clusterColor){
					if( !unique[clusterColor] && clusterColor ) {
							clusterColors.push(clusterColor);
							unique[clusterColor] = "color added!";
					}
				});
				console.log(clusterColors);
				
				boxesHTML = "";
				clusterColors.forEach(function(clusterColor){
					boxesHTML += '<div class="box" style = "width: ' + (1 / clusterColors.length * 100) + '%; background-color: ' + clusterColor + '"></div>';
				});
				
				return new L.DivIcon({ html: '<div class=\'circle\'>' + boxesHTML + '<div class="number">' + cluster.getChildCount() + '</div></div>' });
			}
		});
		
		for( name in $scope.candidates ){
			if( $scope.candidates.hasOwnProperty(name) ){
			
				if( currentColor < ($scope.colors.length -1) )
					currentColor++;
				else
					currentColor = 0; 
				
				$scope.candidates[name].color = $scope.colors[currentColor];
		
				lastLatLng = [];
				
				// Cycle through trips
				$scope.candidates[name].forEach( function(trip){
					// Loop through stops
					for( i=0; i<=trip.stops.length - 1; i++) {
						
						// If this stop goes nowhere (is at 0,0) let's remove it before it causes MORE trouble
						if( trip.stops[i].lat == 0 ) {
							trip.stops.splice(i, 1);
							continue;
						}
						
						
						
						// If we've just moved from a previous chain, connect to it with a dotted line
						/*
						if( lastLatLng.length > 0 ){
							L.polyline([ [trip.stops[i].lat, trip.stops[i].lng], lastLatLng ], {
								color: $scope.colors[currentColor],
								dashArray: "3,10"
							}).addTo(map);
							lastLatLng = [];
						}
						*/
						
						// Which stop are we on?? If a trip has multiple stops, connect with solid line
						if( i > 0 ){
							
							/*
							L.polyline([ [trip.stops[i].lat, trip.stops[i].lng], [trip.stops[i-1].lat, trip.stops[i-1].lng] ], {
								color: $scope.colors[currentColor]
							}).addTo(map);
							*/
							
							addMarker([trip.stops[i].lat, trip.stops[i].lng], trip, $scope.colors[currentColor], 10, markers);
						
						} else {
							lastLatLng = [trip.stops[i].lat, trip.stops[i].lng];
							
							// If we're on the first stop of the last trip, lay the portrait down
							if( $scope.candidates[name].indexOf(trip) == 0 ){
								// Add portrait marker
								var marker = new L.marker([trip.stops[i].lat, trip.stops[i].lng], {
									icon: L.divIcon({
										html: "<div class='portrait' style='background-color: " + $scope.colors[currentColor] + "'><img src='/assets/" + name.replace(" ", "") + ".png' /></div>",
										iconSize: [50,50],
										className: ""
									})
								});
								
								clickMarker(marker, trip);
							
								markers.addLayer(marker);
							
							} else {
								addMarker([trip.stops[i].lat, trip.stops[i].lng], trip, $scope.colors[currentColor], 10, markers);
							}
						}
					}
				});
			}	
		}
		
		map.addLayer(markers);
		
	}).error(function(data, status, headers, config){
		throw "Looks like we couldn't get data: " + data;
	});
	
	function addMarker(LatLng, trip, color, radius, markers){
		
		var marker = new L.circleMarker(LatLng, {
			fillColor: color,
			fillOpacity: .8,
			weight: 5,
			color: color,
			strokeOpacity:.4,
			radius: radius
		});
		

		clickMarker(marker, trip);
		
		markers.addLayer( marker );
	}
	
	$scope.clickTrip = function(trip){

		selectTrip(trip);		
		map.setView([trip.stops[0].lat, trip.stops[0].lng], 7);
	}
	
	function selectTrip(trip){

			$scope.data.forEach(function(datum){ datum.selected = false; })
			trip.selected=true;

	}
	
	function clickMarker(marker, trip){
		marker.on("click", function(e){
			$scope.$apply(function(){
				selectTrip(trip);				
			});
			
			$("#rail").scrollTo($("#" + trip.tripid), 250); // Yep, I use jQuery here. Sue me.
		});
	}
	
	$scope.submit = function(){
		url="";
		for (var key in $scope.params) {
		    if (url != "") {
		        url += "&";
		    }
		    url += key + "=" + encodeURIComponent($scope.params[key]);
		}
		console.log(url);
		window.location = "/map/?" + url;
	};
	
	$scope.moveTarget = function(trip, color){
			target.setLatLng([trip.stops[0].lat, trip.stops[0].lng]);
			target.setStyle({ opacity: 1, color: color });
	}
	
	$scope.clearTarget = function(){
		target.setStyle({ opacity: 0 });
	}
	
}]);

// This directive resizes the map dynamically so it takes up window space not occupied by the rail.
app.directive("map", function(){
	return function(scope, element, attr){
		resize();
		angular.element(window).on("resize", resize);
		
		function resize(){
			element.css({
				width: (element.parent()[0].offsetWidth - element.parent().children()[0].offsetWidth) + "px"
			});
		}
	}
});