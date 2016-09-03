/* ===================================================
 * Sensor.h
 * ---------------------------------------------------
 * Sensor decoding from 433 Message
 *
 *  Created on: 17 sept. 2013
 *  Author: disk91 / (c) www.disk91.com
  * ===================================================
 */

#ifndef SENSOR_H_
#define SENSOR_H_

#define SENS_CLASS_NONE	-1			// Not initialized
#define SENS_CLASS_MTP	 0			// MyTeePi virtual or phisical sensor
#define SENS_CLASS_OS	 1			// Oregon Scientific

#define SENS_TYP_MTP_CPU	0		// cpu temperature
#define SENS_TYP_MTP_INT	1		// internal temperature

#define SENS_TYP_OS_1D20	0x1D20	// THGR122NX
#define SENS_TYP_OS_EC40	0xEC40	// THN132N

class Sensor {

protected:
	double	temperature;
	double	humidity;
	int 	channel;
	bool	battery;			// true if flag set (battery low)

	bool	haveTemperature;	// true when temp capaciy decoded
	bool	haveHumidity;		// true when hum capcity decoded
	bool	haveBattery;		// true when battery flag decoded
	bool 	haveChannel;		// true when channel is present
	bool	isValid;			// true when chaecksum is valid and other value valid

	int		sensorClass;		// marque du sensor cf #define
	int		sensorType;			// model of sensor

	time_t  creationTime;		// objectCreation time

	static char	_hexDecod[];
	virtual bool decode ( char * _str) = 0 ;		// decode the string and set the variable

protected:
	int getIntFromChar(char c);		// transform a Hex value in char into a number
	int getIntFromString(char *);	// transform a Hex value in String into a number
	double getDoubleFromString(char *);	// transform a BCD string into a double



public:

	Sensor( char * _strval );	// construct and decode value

	bool availableTemp();		// return true if valid && have Temp
	bool availableHumidity();	// return true if valid && have Humidity
	bool isBatteryLow();		// return true if valid && haveBattery && flag set.
	bool hasChannel();			// return true if valid && haveChannel
	bool isDecoded();			// return true if valide

	double getTemperature();	// return temperature in C°
	double getHumidity();		// return humidity in % (base 100)
	int getChannel();			// return channel value

	int getSensClass();			// return sensor class
	int getSensType();			// return sensor type

	time_t getCreationTime();	// return object creation time

	static Sensor * getRightSensor(char * s);	// wrapper for child class

};


class OregonSensorV2 : public Sensor {
	public :
		OregonSensorV2( char * _strval );

	private:
		bool decode( char * _str );			// wrapper to right decode method
		bool decode_THGR122NX(char * pt); 	// decode sensor informations
		bool decode_THN132N(char * pt);		// decode sensor informations
		bool validate(char * _str, int _len, int _CRC, int _SUM);	// Verify CRC & CKSUM

};


#endif /* SENSOR_H_ */
