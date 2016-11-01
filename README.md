﻿# com.jilles.oregon
﻿
﻿
Homey app to view Oregon Scientific sensor info in Athom Homey

It can take a time before the app reads a interpretable signal from the sensor , wait an hour before trying to pair a device.

After battery change with reset the rolling code( last 2 hex digits from the name ) can be changed and the device should be repaired.

The RF 2.1 and 3.0 protocol from  Oregon Scientific can be read.



I have now 6 sensor devices added the BTHR968 device id 5d60 (first for hex digits from name) and the
THGR122NX, THGN132ES, THGR228N device id 1d20 rainmeter PCR800 deviceid 2914 and uv meter UVR128 deviceid ec70



## changeLog

19-09-2016 added THN132N sensor to be tested yet by third party , i dont have that sensor.
           Install THWR800 or THR238NF as THN132N sensor.

09-10-2016: version 0.0.19 : fixed a bug where devices were undefined after ptp or reboot homey or restart app.
           App crashed immediately after start.



http://wmrx00.sourceforge.net/Arduino/OregonScientific-RF-Protocols.pdf

https://help.github.com/articles/about-writing-and-formatting-on-github/

[![Paypal donate][pp-donate-image]][pp-donate-link]
[pp-donate-link]: https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=42UGL52J4KPZE
[pp-donate-image]: https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif






Copyright (c) 2016 Jilles Miedema

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
Contact GitHub API Training Shop Blog About
© 2016 GitHub, Inc. Terms Privacy Security Status Help


