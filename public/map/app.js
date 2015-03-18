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
	}).success(function(data,status,headers,config){
		
	});
	
}])