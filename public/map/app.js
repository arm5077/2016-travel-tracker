app = angular.module("mapApp", []);

// Configure $location and set to HTML5 mode
app.config(['$locationProvider', function($locationProvider) {
        $locationProvider.html5Mode({
			enabled: true,
			requireBase: false
		});
    }]);

app.controller("mapController", ["$scope", "$http", "$location", function($scope, $http, $location){
	
	$scope.defaultColors = [
		"#dc4239",
		"#e3c009",
		"#72a199",
		"#2473b1",
		"#e97f83",
		"#60b7b9",
		"#c2b49a",
		"#bcbc5a"
	];
	
	$scope.moment = moment;
	$scope.states = states;
	$scope.search = false;
	
	// Initialize map
	var map = L.map('map', {
		maxZoom: 7,
		minZoom: 3
	});

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

		$scope.params.start = $scope.params.start || moment().subtract(7,'days');
		$scope.params.start = new Date( $scope.params.start );
		$scope.params.end = $scope.params.end || new Date();
		$scope.params.end = new Date( $scope.params.end );
		$scope.params.state = $scope.params.state || "*";
		$scope.standalone = $scope.params.standalone || true;
		$scope.intro = $scope.params.intro || false;
		console.log($scope.params.intro);	
		$scope.data = data.results;
		$scope.count = data.count;
		
		// If standalone, zoom the map out a bit. Other, it's in the app -- zoom it in.
		if( $scope.standalone )
			map.setView([39.8282, -98.5795], 3);
		else
			map.setView([39.8282, -98.5795], 4);
		
		// Build new array with candidate as the base
		$scope.candidates = {};
		data.results.forEach(function(trip){
			if( !$scope.candidates.hasOwnProperty( trip.candidate ) )
				$scope.candidates[trip.candidate] = [];
			$scope.candidates[trip.candidate].push(trip);
		});
		
		if( $scope.params.colors ){
			$scope.colors = {};
			$scope.params.colors.split(",").forEach(function(color, index){
				$scope.colors[ $scope.params.candidates.split(",")[index] ] = "#" + color;
			});
		}
		else {
			$scope.colors = {};
			var currentColor = 0;
			for(name in $scope.candidates){
				if( currentColor >= $scope.defaultColors.length)
					currentColor = 0;
				$scope.colors[name.replace(" ","")] = $scope.defaultColors[currentColor];
				currentColor++;
			};
		}

		var markers = new L.MarkerClusterGroup({
			maxClusterRadius: 40,
			spiderfyDistanceMultiplier: 3,
			showCoverageOnHover: false,
			singleMarkerMode: true,
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
				
				boxesHTML = "";
				clusterColors.forEach(function(clusterColor){
					boxesHTML += '<div class="box" style = "width: ' + (1 / clusterColors.length * 100) + '%; background-color: ' + clusterColor + '"></div>';
				});
				
				return new L.DivIcon({ html: '<div class=\'circle\'>' + boxesHTML + '<div class="number">' + cluster.getChildCount() + '</div></div>' });
			}
		});
		
		for( name in $scope.candidates ){
			if( $scope.candidates.hasOwnProperty(name) ){
			
			
				$scope.candidates[name].color = $scope.colors[name.replace(" ","")];
		
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
							
							addMarker([trip.stops[i].lat, trip.stops[i].lng], trip, $scope.colors[name.replace(" ","")], 10, markers);
						
						} else {
							lastLatLng = [trip.stops[i].lat, trip.stops[i].lng];
							
							// If we're on the first stop of the last trip, lay the portrait down
							
							/*
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
							*/	addMarker([trip.stops[i].lat, trip.stops[i].lng], trip, $scope.colors[name.replace(" ","")], 10, markers);
							//}
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
		
		var marker = new L.marker(LatLng, {
			color: color,
			icon: '<div class=\'circle\'><div class="number">1</div></div>'
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
		window.location = "/map/?" + url;
	};
	
	$scope.moveTarget = function(trip, color){
			target.setLatLng([trip.stops[0].lat, trip.stops[0].lng]);
			target.setStyle({ opacity: 1, color: color });
	}
	
	$scope.clearTarget = function(){
		target.setStyle({ opacity: 0 });
	}
	
	$scope.getStateName = function(abbrev){
		name = $scope.states.filter(function(state){ return(state.state == abbrev) })[0].Name;
		return (name == "All states") ? "all states" : name;
	}
	
}]);

// This directive resizes the map dynamically so it takes up window space not occupied by the rail.
app.directive("map", function(){
	return function(scope, element, attr){
		resize();
		angular.element(window).on("resize", resize);
		
		setInterval(resize, 1000)
		
		function resize(){
			element.css({
				width: (element.parent()[0].offsetWidth - element.parent().children()[0].offsetWidth) + "px"
			});
		}
	}
});

