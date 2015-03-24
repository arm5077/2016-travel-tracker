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
	
}]);