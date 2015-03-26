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
	$scope.mapString = "";
	$scope.selectedCandidates = [];
	$scope.start = moment().subtract(7,'days').toDate();
	$scope.end = new Date();
	$scope.state = "*";
	$scope.search = false;
	$scope.states = states;
	$scope.intro = true;
	
	$http({
		url: "/candidates",
		method: "GET",
		params: $scope.parameters
	}).success(function(data, status, headers, config){
		$scope.candidates = data.results;
		
		// Order candidates by most trips
		$scope.candidates.sort(function(a,b){  return b.total - a.total });
		
		// Set initialization for candidates
		$scope.candidates.forEach(function(candidate){ 
			candidate.closed=true; 
			candidate.selected = true;
			$scope.selectedCandidates.push(candidate);
		});
		

		
		$scope.max = Math.max.apply(null, $scope.candidates.map(function(d){ return Math.max.apply(null, d["most-visited"].map(function(d){ return d.count; }))  }));
		
		// Assign colors
		$scope.candidates.forEach(function(candidate, i){
			candidate.color = colors[i];
		});
		
		$scope.createURLString();
				
	}).error(function(err){
		console.log("Error getting data: " + err);
	});
	
	
	$scope.imageURL = function(name){
		return name.replace(" ", "").toLowerCase().replace("'","") + ".png";
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
		return $sce.trustAsResourceUrl("/map" + $scope.mapString);
	};
	
	$scope.handleCandidateClick = function(candidate){
		var obj = {name: candidate.name, color: candidate.color};
		console.log("Looking at " + candidate.name);
		if( candidate.selected ){
			
			console.log( $scope.selectedCandidates.map(function(c){ return c.name }).indexOf(candidate.name) );
			index = $scope.selectedCandidates.map(function(c){ return c.name }).indexOf(candidate.name)
						
			$scope.selectedCandidates.splice( index, 1);
			
		} else {
			$scope.selectedCandidates.push(obj);
		}
		
		$scope.createURLString();
		
		candidate.selected = !candidate.selected;
	};
	
	$scope.createURLString = function(){
		$scope.mapString = "";
		var candidateString = "";
		var colorString = "";
		
		$scope.selectedCandidates.forEach(function(candidateObj){
			candidateString += candidateObj.name.replace(" ","") +",";
			colorString += candidateObj.color.replace("#","") +",";
		});
		
		colorString = colorString.slice(0,-1);
		
		$scope.mapString = "?candidates=" + candidateString + "&colors=" + colorString + "&standalone=false&start=" + $scope.start + "&end" + $scope.end + "&state=" + $scope.state + "&intro=" + $scope.intro;
	}
	
	$scope.expandAll = function(){
		$scope.candidates.forEach(function(candidate){ 
			candidate.closed=false; 
		});
	}
	
	$scope.collapseAll = function(){
		$scope.candidates.forEach(function(candidate){ 
			candidate.closed=true; 
		});
	}
	
	$scope.selectAll = function(){
		$scope.selectedCandidates = [];
		$scope.candidates.forEach(function(candidate){ 
			candidate.selected = true;
			$scope.selectedCandidates.push(candidate);
		});
		$scope.createURLString();
	}
	
	$scope.unselectAll = function(){
		$scope.selectedCandidates = [];
		$scope.candidates.forEach(function(candidate){ 
			candidate.selected = false;
		});
		$scope.createURLString();
	}
	
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
				height: Math.min((window.innerHeight * .8 ), 450) + "px"
			});
		}
	}
});

app.directive("center", function(){
	return function(scope, element, attr){
		resize();
		angular.element(window).on("resize", resize);
		
		function resize(){
			element.css({
				top: "25px",
				left: ((window.innerWidth - element[0].offsetWidth) / 2 ) + "px"
			});
		}
	}
});