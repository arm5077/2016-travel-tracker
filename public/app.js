app = angular.module("travelApp", []);

// Configure $location and set to HTML5 mode
app.config(['$locationProvider', function($locationProvider) {
        $locationProvider.html5Mode({
			enabled: true,
			requireBase: false
		});
    }]);

app.controller("travelController", ["$scope", "$http", "$location", function($scope, $http, $location){
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
		height = value / Math.max.apply(null, data.map(function(d){ return d.count })) * $scope.chartHeight;
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

