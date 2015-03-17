# Dump of table candidates
# ------------------------------------------------------------

DROP TABLE IF EXISTS `candidates`;

CREATE TABLE `candidates` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  `party` char(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table places
# ------------------------------------------------------------

DROP TABLE IF EXISTS `places`;

CREATE TABLE `places` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `city` varchar(50) DEFAULT NULL,
  `state` varchar(3) DEFAULT NULL,
  `lat` double DEFAULT NULL,
  `lng` double DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `citystate` (`state`,`city`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table stops
# ------------------------------------------------------------

DROP TABLE IF EXISTS `stops`;

CREATE TABLE `stops` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `tripid` int(11) DEFAULT NULL,
  `placeid` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table trips
# ------------------------------------------------------------

DROP TABLE IF EXISTS `trips`;

CREATE TABLE `trips` (
  `tripid` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `candidate` varchar(50) DEFAULT NULL,
  `state` varchar(3) DEFAULT NULL,
  `start` date DEFAULT NULL,
  `end` date DEFAULT NULL,
  `total_days` int(11) DEFAULT NULL,
  `accompanied_by` varchar(150) DEFAULT NULL,
  `notes` varchar(400) DEFAULT NULL,
  PRIMARY KEY (`tripid`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

