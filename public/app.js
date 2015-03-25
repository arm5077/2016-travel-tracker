app = angular.module("travelApp", []);

// Configure $location and set to HTML5 mode
app.config(['$locationProvider', function($locationProvider) {
        $locationProvider.html5Mode({
			enabled: true,
			requireBase: false
		});
    }]);

app.controller("travelController", ["$scope", "$http", "$location", "$sce", function($scope, $http, $location, $sce){
	$scope.parameters = $location.search();
	$scope.padding = .1;
	$scope.minHeight = 10;
	$scope.chartHeight = 60;
	
	$http({
		url: "/candidates",
		method: "GET",
		params: $scope.parameters
	}).success(function(data, status, headers, config){
		$scope.candidates = data.results;
		
		$scope.candidates.forEach(function(candidate){ 
			candidate.closed=true; 
		});
		
		$scope.max = Math.max.apply(null, $scope.candidates.map(function(d){ return Math.max.apply(null, d["most-visited"].map(function(d){ return d.count; }))  }));
		
		// Assign colors
		$scope.candidates.forEach(function(candidate, i){
			candidate.color = colors[i];
		});
				
	}).error(function(err){
		console.log("Error getting data: " + err);
	});
	
	
	$scope.imageURL = function(name){
		return name.replace(" ", "") + ".png";
	}
	
	$scope.barWidth = function(data) {
		return (100 / 5) * (1 - $scope.padding);
		//return (100 / data.length) - ($scope.padding / (data.length - 1));
	};
	
	$scope.barHeight = function(value, data){
		//height = value / Math.max.apply(null, data.map(function(d){ return d.count })) * $scope.chartHeight;
		//console.log(Math.max.apply(null, $scope.candidates.map(function(d){ return Math.max.apply(null, d["most-visited"].map(function(d){ return d.count; }))  })));
		height = value / $scope.max * $scope.chartHeight;
		if( height < $scope.minHeight )
			return $scope.minHeight;
		else 
			return height;

	};
	
	$scope.barTop = function(value, data){
		if( $scope.barHeight(value, data) < $scope.minHeight )
			return $scope.chartHeight - $scope.minHeight;
		else 
			return $scope.chartHeight - $scope.barHeight(value, data);
	};	
	
	$scope.barLeft = function(value, data) {
		index = data.map(function(data){ return data.state}).indexOf(value);
		return index * $scope.barWidth(data) + (index * $scope.padding * (100 / (4 ) ) );
	};

	$scope.makeURL = function(params){
		return $sce.trustAsResourceUrl("/map");
	};
	
	
}]);

app.directive("bar", function() {
	return {
		restrict: 'E',
		link: function(scope, element, attr) {
			element.css({
				width: scope.barWidth(scope.candidate["most-visited"]) + "%"
			});
		}
	};	

});

app.directive("map", function(){
	return function(scope, element, attr){
		resize();
		angular.element(window).on("resize", resize);
		
		function resize(){
			element.css({
				height: (window.innerHeight * .8 ) + "px"
			});
		}
	}
});
