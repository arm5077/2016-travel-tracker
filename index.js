var express = require("express");
var app = express();
var moment = require('moment');
var Spreadsheet = require('edit-google-spreadsheet');
var mysql = require("mysql");
var geocoder = require('node-geocoder').getGeocoder("openstreetmap");;
var apicache = require('apicache').options({ debug: true }).middleware;  // Caches API responses
var firstBy = require('thenBy.js');
var madison = require('madison'); // Converts state names to abbreviations and back

// Turn on server
var port = process.env.PORT || 3000;
app.listen(port, function(){
	console.log("We're live at port " + port + ".");
});

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
}
app.use(allowCrossDomain);

// Create pool of connections
global.pool = mysql.createPool(process.env.CLEARDB_DATABASE_URL || "mysql://root@localhost/travel");
pool.on("error", function(err){  
	console.log(err);
	pool.end;
});


// Set up static page (main page)
app.use("/", express.static(__dirname + "/public/"));

// Set up static page (map screen)
app.use("/map", express.static(__dirname + '/public/map'));

// Assets endpoint
app.use("/assets", express.static(__dirname + '/public/assets'));

app.get("/api/candidates", apicache("5 minutes"), function(request, response){
	var results = [];
	var pending = 0;
  
  
  pool.getConnection(function(err, connection){
	  connection.query("SELECT trips.tripid, trips.candidate, candidates.party, places.city, trips.state, accompanied_by, notes, start \
  					FROM (SELECT * FROM trips ORDER BY start DESC) as trips \
  					JOIN candidates on candidates.name=trips.candidate \
  					JOIN (select * from stops ORDER BY tripid DESC) as stops on stops.tripid = trips.tripid \
  					JOIN places on stops.placeid=places.id \
  					GROUP BY candidate ORDER BY candidate", 
  	function(err, rows, header){	
  		if(err) throw err;
  		rows.forEach(function(candidate){
  			pending++;
			
  			// Get state by state count
  			connection.query("select state, count(state) as count from trips WHERE candidate=? GROUP BY state order by count DESC limit 5", [candidate.candidate], function(err, trips, header){
  				if(err) throw err;
  				pending--;
  				pending++;
  				connection.query("SELECT candidate, COUNT(*) as trips FROM trips WHERE candidate = ?", [candidate.candidate], function(err, count, header){
  					pending--;
  					results.push({"name": candidate.candidate, party: candidate.party, total: count[0].trips, "last-seen": candidate, "most-visited": trips});
  					if(pending <= 0) {
  						console.log("closing connection");
              connection.release();
  						response.status(200).json({ count: rows.length, results: results });
  					}
  				});		
  			});
  		});	
  	});
  });
});

app.get("/api/widget", apicache("5 minutes"), function(request, response){
	
	pool.getConnection(function(err, connection){
	  connection.query("SELECT trips.tripid, candidates.name, candidates.party, trips.state, trips.start, trips.end, places.city, trips.notes  FROM trips JOIN stops ON trips.tripid = stops.tripid JOIN places ON stops.placeid = places.id join candidates on candidates.name = trips.candidate WHERE start <= '" + moment( new Date() ).format("YYYY-MM-DD") + "' ORDER BY start DESC, stops.id ASC LIMIT 20", function(err, rows, header){

  		// Cycle through and aggregate on tripid
  		var trips = [];
		
  		rows.forEach(function(row){
  			var tripIndex = trips.map(function(d){ return d.tripid }).indexOf(row.tripid);
  			if( tripIndex == -1 ){
  				trips.push({ tripid: row.tripid, candidate: row.name, party: row.party, date: row.start, formatted_date: moment(row.date).format("MMM D, YYYY"), state: row.state, notes: row.notes, stops:[], stopCount: 0 });
  				tripIndex = trips.length - 1
  			}
  			trips[tripIndex].stops.push({ city: row.city, state: madison.getStateNameSync(row.state) });
  			trips[tripIndex].stopCount++;
  		});
		  
		  connection.release();
  		response.status(200).json({ results: trips });
  	});
  });
	
});

app.get("/api/trips", apicache('5 minutes'), function(request, response){
		
	var result = {};
	var params = "";
	
	pool.getConnection(function(err, connection){
	  // As of now, you need to specify a candidate to search for
  	if( !request.query.candidates ){
  		connection.release();
  		response.status(200).json({ count: 0, results: [], params: request.query });
  	}
  	else {
  		// Handle query parameters
  		if( request.query.start ){
  			params += " AND start >=" + connection.escape(moment( new Date(request.query.start) ).format("YYYY-MM-DD")); 
  		} else {
  			// Default to returning results from within the past week.
  			params += " AND start >=" + connection.escape(moment( new Date(request.query.start) ).subtract(7,"days").format("YYYY-MM-DD"))
  		}
  		if( request.query.end )
  			params += " AND end <=" + connection.escape(moment( new Date(request.query.end) ).format("YYYY-MM-DD"));
  		if( request.query.state && request.query.state != "*" )	
  			params += " AND state = " + connection.escape( request.query.state );
  		if( request.query.candidates) {
  			params += " AND (";
  			candidates = request.query.candidates.split(",");
  			candidates.forEach(function(candidate){
  				params += " REPLACE(candidate, ' ', '') = " + connection.escape(candidate) + " OR"; 
  			});
  				params = params.slice(0,-3);
  				params += ")";
  		}

  		query_string = "SELECT * FROM trips WHERE 1=1" + params + " ORDER BY start DESC";

  		connection.query(query_string, function(err, rows, header){
  			if( err ) throw err;
  			if( rows.length == 0 ){
  				connection.release();
  				response.status(200).json({ count: rows.length, results: rows, params: request.query });
  			}
  			else {
  				var queryCount = 0;
  				rows.forEach(function(trip){
  					queryCount++; 
  					connection.query("SELECT stops.id, places.id as placeid, places.city, places.state, places.lat, places.lng FROM stops JOIN places ON stops.placeid = places.id WHERE tripid = ? ORDER BY stops.id ASC", [trip.tripid], function(err, stops, header){
  						if( err ) throw err;
  						trip.stops = stops;
  						queryCount--;
  						if( queryCount <= 0 ) {
  							connection.release();
  							response.status(200).json({ count: rows.length, results: rows, params: request.query });
  						}
  					});
  				});
  			}
  		});
  	}
	});
});