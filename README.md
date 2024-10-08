# ECG Data Processor

**ECG Data Processor** is a JavaScript library designed for analyzing and processing ECG data. It provides tools for filtering noise, detecting key PQRST waveforms, and calculating clinical indicators such as PR interval, QRS duration, and heart rate.

## Features
- Noise filtering (high-pass, low-pass, and notch filters)
- Detection and extraction of PQRST waves
- Calculation of PR interval, QRS duration, QT interval, and heart rate
- Real-time and batch ECG signal processing
- Configurable for different sampling rates and heart rates

## Installation
Install the library using npm:
```bash
npm install ecg-data-processor
```

## Usage
Here’s a basic example of using the library:
```javascript
const ecgProcessor = require('ecg-data-processor');

const ecgData = [ 0.05, 0.1,  0.15, ...];  // ECG data points [time (ms), voltage]
const processedData = ecgProcessor.process(ecgData);

console.log(processedData);
```

## Example 
The following example demonstrates how to use the library to process ECG data:
1. Prepare your ECG voltage(usually between -1.5mV ~ 1.5mV) data in a text file (e.g., ecg.txt), where each line represents a single data point (a numeric value). For example:
```text
0.061165
0.075489
0.089244
0.100792
0.10895099999999999
0.11308700000000001
0.11303
0.109092
...
```
3. Process the data using the library in your code:
```javascript
import { process } from 'ecg-data-process';
import fs from 'fs';
import path from 'path';

// Read ECG data from a file
const filePath = path.resolve('test/ecg.txt');
const fileContent = fs.readFileSync(filePath, 'utf-8');

// Parse ECG data
const ecgData = fileContent.split('\n').map(line => {
    return line.trim() * 1;
});

// Process the data with a specific frequency (e.g., 511.547 Hz)
const processedData = process(ecgData, 511.547);

// Get the result
const processedResult = processedData.getResult();

console.log(processedResult.summary);
console.log(processedResult.segments[0].beats[0]);
```
### Output
The processed result will provide the following summary:
```json
{
  "hr": 81,
  "st": 0.0881,
  "pr": 143.68,
  "qrs": 137.17
}
```

* HR: Heart Rate (beats per minute)
* ST: ST segment (seconds)
* PR: PR interval (milliseconds)
* QRS: QRS duration (milliseconds)

The processed result will also provide the following beats:
```json
{
  "valid": true,
  "start_time": 263.9053693990972,
  "end_time": 840.5874729008282,
  "p": {
    "start_time": 322.55100704334103,
    "end_time": 351.87382586546295,
    "peak_time": 342.09955292475564,
    "peak_voltage": 0.061911
  },
  "q": {
    "start_time": 400.7451905689995,
    "end_time": 459.3908282132433,
    "peak_time": 449.616555272536,
    "peak_voltage": -0.08918899999999999
  },
  "r": {
    "start_time": 459.3908282132433,
    "end_time": 508.26219291677984,
    "peak_time": 488.7136470353652,
    "peak_voltage": 0.25517439999999997
  },
  "s": {
    "start_time": 508.26219291677984,
    "end_time": 566.9078305610236,
    "peak_time": 537.5850117389017,
    "peak_voltage": -0.1733224
  },
  "t": {
    "start_time": 635.3277411459748,
    "end_time": 762.3932893751697,
    "peak_time": 723.2961976123405,
    "peak_voltage": 0.170142
  }
}
```

## More Usage

For additional usage examples, you can refer to the test code in the `/test` directory.

## Options Description
all options are optional, you can use the default values if you don't want to change them.

- **debug**: `boolean` (default: `false`)
    - Enables or disables debug mode. When set to `true`, additional log information will be output for troubleshooting or analysis purposes.

- **aggregation**: `number` (default: `Math.floor(frequency / 100)`)
  - The number of data points to aggregate, which helps block high-frequency noise in the ECG data. A higher value means more aggregation, reducing noise but potentially losing fine details. The default value is based on the sampling frequency of the data.

- **rPeakSlopeThreshold**: `number` (default: `0.05`)
    - The threshold for detecting the slope of R-peaks in the ECG waveform. Lower values may result in more sensitive peak detection, while higher values will detect fewer peaks.

- **rPeakMinDistance**: `number` (default: `30`)
    - The minimum distance (in data points) between consecutive R-peaks. This prevents false R-peak detection when two peaks are too close to each other.

- **smoothWindowSize**: `number` (default: `5`)
    - The window size for the smoothing function applied to the ECG data. A larger window results in more smoothing, but may reduce the clarity of certain waveforms.

- **baselineFilter**: `enum` (default: `LOWPASS`)
  - The filter used to remove baseline wander from the ECG signal. It can take the following values:
    - `LOWPASS`: A low-pass filter to smooth out high-frequency noise (default).
    - `MEDIAN`: A median filter for removing noise while preserving sharp edges.
    - `MEAN`: A mean filter for averaging nearby values.

  Users can select a filter by importing the available filters:
  ```javascript
  import { filters } from 'ecg-data-process';
  const filter = filters.LOWPASS; // Example
  ```

- **baselineFilterOptions**: `object`
  - The configuration options for the selected baseline filter:
    - **alpha**: `number` (default: `0.05`)
      - Used when the `LOWPASS` filter is selected. It controls the smoothing factor, with lower values providing smoother output by giving more weight to previous data points.
    - **windowSize**: `number` (default: `20`)
      - Used when the `MEDIAN` or `MEAN` filters are selected. It determines the number of data points considered for filtering.

- **throughMinDistance**: `number` (default: `10`)
    - The minimum distance (in data points) between consecutive troughs in the ECG waveform. This ensures that noise or small variations do not cause false detection of troughs.

- **useDirectData**: `boolean` (default: `false`)  
  If `true`, the `process` function will treat `ecgData` as `[[time_in_seconds/frequency, voltage], ...]` and will not aggregate any data.

- **minPWaveHeight**: `number` (default: `0`)  
  This option sets the minimum height threshold for detecting P-waves in the ECG signal. It is used to filter out noise and prevent false identification of P-waves that may be caused by low-amplitude noise. If the detected P-wave's amplitude is below this threshold, it will be ignored in the analysis.

- **minTWaveHeight**: `number` (default: `0.1`)  
  This option sets the minimum height threshold for detecting T-waves in the ECG signal. Similar to the `minPWaveHeight`, it is used to filter out noise and prevent false identification of T-waves with low amplitude. Only T-waves that meet or exceed this height will be considered valid in the analysis.


# Changelog

## [1.2.0] - 2024-10-02

### Major Changes
- **Rewrote Algorithm for QRS Complex Detection**:
  - Improved accuracy in detecting the QRS complex with enhanced accuracy, especially in noisy datasets.

- **Added New Options for Wave Identification**:
  - **`minPWaveHeight`**: New option introduced to filter out noise and improve the accuracy of P-wave identification by setting a minimum height threshold.
  - **`minTWaveHeight`**: New option introduced to filter out noise and improve the accuracy of T-wave identification by setting a minimum height threshold.

### Bug Fixes
- Fixed various bugs related to wave detection and noise filtering.

## [1.1.6] - 2024-09-18
- Improve ST Voltage accuracy.

## [1.1.4] - 2024-09-17
- Improve algorithm accuracy.

## [1.1.3] - 2024-09-16
- Bug fix: Potential array index out of bounds error. 

## [1.1.2] - 2024-09-16
- improve the documentation.

## [1.1.0] - 2024-09-16

### Added
- **useDirectData** option: When set to `true`, the `process` function uses the ECG data directly as `[[time_in_seconds/frequency, voltage], ...]` without aggregation.
- Added test file **`use_direct_data.test.mjs`** to validate the functionality of the `useDirectData` option.
- Fixed some bugs.

## [1.0.0] - 2024-09-15

### Added
- Initial release of the **ECG Data Processor** library.
- Added support for ECG data processing, including:
  - **Noise filtering**.
  - **PQRST wave detection**.
  - **Clinical indicator calculations** (heart rate, PR, QRS, etc.).
- Introduced several configuration options:
  - **debug**: Toggle debug mode.
  - **aggregation**: Controls data aggregation and noise blocking.
  - **rPeakSlopeThreshold**: Threshold for R peak detection.
  - **rPeakMinDistance**: Minimum distance between R peaks.
  - **smoothWindowSize**: Window size for data smoothing.
  - **baselineFilter**: Enum for baseline filtering methods (`LOWPASS`, `MEDIAN`, `MEAN`).
  - **baselineFilterOptions**: Options for baseline filtering, including `alpha` and `windowSize`.
  - **throughMinDistance**: Minimum distance between through points.

### Tests
- Added test cases in `/test/default_with_noise.test.js` for verifying ECG data processing.
- 
## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Let me know if you'd like to modify any sections!