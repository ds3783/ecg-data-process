/**
 *
 * ECG Data Process
 *
 * This script is used to process the ECG data.
 * Input: ECG data in the form of an array of time and voltage values.
 * Output: Processed ECG data in the form as below:
 * {
 *      summary: {
 *       hr: 0,
 *       st: 0,
 *       pr: 0,
 *       qrs: 0,
 *       }
 *   segments:[
 *       {
 *       start_time: 0,
 *       end_time: 0,
 *       summary: {
 *       hr: 0,
 *       st: 0,
 *       pr: 0,
 *       qrs: 0,
 *       }
 *       beats: [
 *       {
 *       valid: true,
 *       start_time: 0,
 *       end_time: 0,
 *       p:{
 *           start_time: 0,
 *           end_time: 0,
 *           peak_time: 0,
 *           peak_voltage: 0,
 *       },
 *       q:{
 *           start_time: 0,
 *           end_time: 0,
 *           peak_time: 0,
 *           peak_voltage: 0,
 *       },
 *       r:{
 *           start_time: 0,
 *           end_time: 0,
 *           peak_time: 0,
 *           peak_voltage: 0,
 *       },
 *       s:{
 *           start_time: 0,
 *           end_time: 0,
 *           peak_time: 0,
 *           peak_voltage: 0,
 *       },
 *       t:{
 *           start_time: 0,
 *           end_time: 0,
 *           peak_time: 0,
 *           peak_voltage: 0,
 *       }
 *       }
 *       ]
 *       }
 *   ],
 *   }
 *
 *
 *   Usage:
 *   let resultObj=ecg_data_process(ecgData, frequency);
 *   console.log(resultObj.getResult());
 *   console.log(resultObj.getOriginalData());
 *   console.log(resultObj.getOriginalFrequency());
 */


function ecg_data_process_v1(ecgData, frequency, options) {
    function resultConstructor(ecgData, frequency, options) {
        this._option = options;
        if (options.useDirectData) {
            this._data = ecgData;
        } else {
            this._data = ecgData.map((val, idx) => [idx * 1000 / frequency, val]);
        }

        this._frequency = frequency;
        this._result = {
            summary: {
                hr: 0,
                st: 0,
                pr: 0,
                qrs: 0
            },
            segments: []
        };
        this._originalData = ecgData;
        this._originalFrequency = frequency;
        this.filterResult = function (result) {
            let resultCopy = JSON.parse(JSON.stringify(result));
            if (this._option.debug) {
                return resultCopy;
            }
            for (const segment of resultCopy.segments) {
                delete segment._data;
                for (const beat of segment.beats) {
                    delete beat.p._data;
                    delete beat.q._data;
                    delete beat.r._data;
                    delete beat.s._data;
                    delete beat.t._data;
                    delete beat._data;
                    delete beat._baseline;
                    delete beat._cut_start;
                    delete beat._cut_end;
                }
            }
            return resultCopy;
        }
        this.getResult = function () {
            return this.filterResult(this._result);
        };
        this.getOriginalData = function () {
            return this._originalData;
        };
        this.getOriginalFrequency = function () {
            return this._originalFrequency;
        }

    }

    function splitData(ecgData) {
        let data = [];
        let segments = [];
        //iterate ecgData
        for (let i = 0; i < ecgData.length; i++) {
            //if the data is not a number
            if (isNaN(ecgData[i][1]) || ecgData[i][1] === null) {
                //push the data to segments
                if (data.length > 0) {
                    segments.push(data);
                    data = [];
                }
            } else {
                //push the data to data
                data.push(ecgData[i]);
            }
        }
        if (data.length > 0) {
            segments.push(data);
        }
        return segments;
    }

    function aggregation(data, groupSize = 5) {
        let result = {
            max: -65535,
            min: 65535,
            middle: 0,
            data: []
        };
        //should by 500 data/sec * 30 seconds
        let dataArr = data || [];
        let dataGroup = [];
        for (let i = 0; i < dataArr.length; i++) {
            const voltage = dataArr[i];
            const prevVoltage = dataArr[i - 1] || null;
            let valid = true;
            if (typeof prevVoltage === 'number') {
                //check if valid
                if (Math.abs(voltage - prevVoltage) > 2) {
                    valid = false;
                }
            }
            if (valid) {
                result.max = Math.max(result.max, voltage);
                result.min = Math.min(result.min, voltage);
                dataGroup.push(voltage);
            }
            if (dataGroup.length >= groupSize) {
                // if middle is larger or smaller than first and last, then it is a peak
                let first = dataGroup[0],
                    last = dataGroup[dataGroup.length - 1],
                    maxVal = Math.max.apply(null, dataGroup),
                    minVal = Math.min.apply(null, dataGroup);
                if (maxVal > first && maxVal > last) {
                    result.data.push(maxVal);
                    dataGroup = [];
                } else if (minVal < first && minVal < last) {
                    result.data.push(minVal);
                    dataGroup = [];
                } else {
                    //get average voltage of dataGroup
                    let sum = 0;
                    for (let j = 0; j < dataGroup.length; j++) {
                        sum += dataGroup[j];
                    }
                    let avg = sum / dataGroup.length;
                    result.data.push(avg);
                    dataGroup = [];
                }
            }
        }

        if (result.max < 1.5 && result.min > -1.5) {
            result.middle = 0;
        } else {
            result.middle = (result.max + result.min) / 2;
            for (let i = 0; i < result.data.length; i++) {
                let value = result.data[i];
                result.data[i] = value - result.middle;
            }
        }
        return result.data;
    }

    function smoothSignal(data, windowSize = 5) {
        return data.map((val, idx) => {
            const start = Math.max(0, idx - Math.floor(windowSize / 2));
            const end = Math.min(data.length, idx + Math.ceil(windowSize / 2));
            const window = data.slice(start, end);
            return [val[0], window.reduce((sum, val) => sum + val[1], 0) / window.length];
        });
    }

    function medianFilter(data, windowSize = 20) {
        const result = [];
        const halfWindow = Math.floor(windowSize / 2);

        for (let i = 0; i < data.length; i++) {
            // Define the window around the current point
            const window = [];
            for (let j = Math.max(0, i - halfWindow); j <= Math.min(data.length - 1, i + halfWindow); j++) {
                window.push(data[j][1]);  // Glucose value is at index 1
            }
            // Sort the window and take the median
            window.sort((a, b) => a - b);
            result.push([data[i][0], window[Math.floor(window.length / 2)]]);
        }
        return result;
    }

    function meanFilter(data, windowSize = 20) {
        const result = [];
        const halfWindow = Math.floor(windowSize / 2);

        for (let i = 0; i < data.length; i++) {
            let sum = 0;
            let count = 0;
            for (let j = Math.max(0, i - halfWindow); j <= Math.min(data.length - 1, i + halfWindow); j++) {
                sum += data[j][1];  // Glucose value is at index 1
                count++;
            }
            result.push([data[i][0], sum / count]);  // Push [time, average glucose value]
        }
        return result;
    }

    function lowPassFilter(data, alpha = 0.15) {
        const result = [];
        let previous = data[0][1];  // Start with the first glucose value

        for (let i = 0; i < data.length; i++) {
            // Apply low-pass filter formula
            let filtered = alpha * data[i][1] + (1 - alpha) * previous;
            result.push([data[i][0], filtered]);  // Push [time, filtered glucose value]
            previous = filtered;
        }
        return result;
    }

    // Function to find local minima (troughs)
    function findTroughs(ecgData, direction = -1, minDistance = 10) {
        let troughs = [];

        if (direction < 0) {
            // Loop through the ECG data and find local minima
            for (let i = ecgData.length - 2; i >= 1; i--) {
                if (ecgData[i][1] < ecgData[i - 1][1] && ecgData[i][1] < ecgData[i + 1][1]) {
                    if (troughs.length > 0) {
                        if (Math.abs(i - troughs[troughs.length - 1]) > minDistance) {
                            troughs.push(i); // Store the index of the trough
                        }
                    } else {
                        troughs.push(i); // Store the index of the trough
                    }
                }
            }
        } else {
            // Loop through the ECG data and find local minima
            for (let i = 1; i < ecgData.length - 1; i++) {
                if (ecgData[i][1] < ecgData[i - 1][1] && ecgData[i][1] < ecgData[i + 1][1]) {
                    if (troughs.length > 0) {
                        if (Math.abs(i - troughs[troughs.length - 1]) > minDistance) {
                            troughs.push(i); // Store the index of the trough
                        }
                    } else {
                        troughs.push(i); // Store the index of the trough
                    }
                }
            }
        }

        return troughs;
    }

    function calculateSlope(signal) {
        const slope = [];
        for (let i = 1; i < signal.length; i++) {
            slope.push(signal[i][1] - signal[i - 1][1]);  // First-order difference
        }
        return slope;
    }

    function getRPeaks(seg, options) {
        let rPeaks = [];
        let smoothed = smoothSignal(seg, options.smoothWindowSize);
        // console.log('smoothed:', smoothed);
        const slope = calculateSlope(smoothed);

        let isPositiveSlope = false;

        // Traverse the slope to detect where slope changes sharply
        for (let i = 1; i < slope.length; i++) {
            if (slope[i] > options.rPeakSlopeThreshold && !isPositiveSlope) {
                // Start of a sharp positive slope
                isPositiveSlope = true;
            } else if (slope[i] < -options.rPeakSlopeThreshold && isPositiveSlope) {
                // End of a sharp positive slope -> this is likely an R-peak
                isPositiveSlope = false;
                let j = i;
                // Reverse search to find the peak
                while (j > 0 && smoothed[j][1] < smoothed[j - 1][1]) {
                    j--;
                }
                if (rPeaks.length === 0 || j - rPeaks[rPeaks.length - 1][0] > options.rPeakMinDistance) {
                    rPeaks.push([j, seg[j]]);  // Add the index as an R-peak
                }
            }
        }

        return rPeaks.map((val) => val[1]);
    }


    function getBeats(rPeaks, seg, options) {
        let beats = [];
        for (let i = 0; i < rPeaks.length; i++) {
            let peak = rPeaks[i];
            let start = i === 0 ? 0 : rPeaks[i - 1][0];
            let end = rPeaks[i + 1] ? rPeaks[i + 1][0] : -1;
            let left = seg.filter((val) => val[0] >= start && val[0] < peak[0]);
            let right = seg.filter((val) => val[0] > peak[0] && ((end > 0 && val[0] <= end) || end < 0));
            //cut the left from second trough value 
            let smoothLeft = smoothSignal(left, options.smoothWindowSize);
            let leftTroughs = findTroughs(smoothLeft, -1, options.throughMinDistance);

            let minLeftItemIndex = 0;
            if (leftTroughs.length >= 2) {
                minLeftItemIndex = leftTroughs[1];
            }

            if (minLeftItemIndex > 0) {
                left = left.slice(minLeftItemIndex);
            }

            //cut the right from peak to second trough value
            let smoothRight = smoothSignal(right, options.smoothWindowSize);

            let minRightItemIndex = 0;
            let rightTroughs = findTroughs(smoothRight, 1, options.throughMinDistance);
            // console.log('rightTroughs', smoothRight, rightTroughs);
            if (rightTroughs.length >= 2) {
                minRightItemIndex = rightTroughs[1];
            }
            if (minRightItemIndex > 0) {
                right = right.slice(0, minRightItemIndex + 1);
                // console.log('smoothRight', smoothRight, right);
            }

            let beat = {
                _data: [].concat(left, [peak], right),
                _cut_start: minLeftItemIndex > 0,
                _cut_end: minRightItemIndex > 0,
                valid: false,
                start_time: left[0][0],
                end_time: right.length > 0 ? right[right.length - 1][0] : null,
                p: {
                    start_time: 0,
                    end_time: 0,
                    peak_time: 0,
                    peak_voltage: 0
                },
                q: {
                    start_time: 0,
                    end_time: 0,
                    peak_time: 0,
                    peak_voltage: 0
                },
                r: {
                    start_time: 0,
                    end_time: 0,
                    peak_time: peak[0],
                    peak_voltage: peak[1]
                },
                s: {
                    start_time: 0,
                    end_time: 0,
                    peak_time: 0,
                    peak_voltage: 0
                },
                t: {
                    start_time: 0,
                    end_time: 0,
                    peak_time: 0,
                    peak_voltage: 0
                }
            };
            beats.push(beat);
        }
        return beats;
    }

    function updateWaves(beats, options) {
        //iterate beats
        for (let beat of beats) {
            let rawData = beat._data;
            let rPeakIndex = rawData.findIndex((val) => val[0] === beat.r.peak_time);
            let left = rawData.slice(0, rPeakIndex + 1);
            let right = rawData.slice(rPeakIndex);
            let smooth = smoothSignal(rawData, options.smoothWindowSize);
            let smoothLeft = smooth.slice(0, rPeakIndex + 1)
            let smoothRight = smooth.slice(rPeakIndex);
            let leftTroughs = findTroughs(smoothLeft, -1, options.throughMinDistance);
            let rightTroughs = findTroughs(smoothRight, 1, options.throughMinDistance);
            let qPeakIndex = null,
                sPeakIndex = null;
            if (leftTroughs.length > 0) {
                qPeakIndex = leftTroughs[0];
            }
            if (rightTroughs.length > 0) {
                sPeakIndex = rightTroughs[0];
            }
            //get baseline voltage
            let baselineLeft = [];
            let baselineRight = [];
            let baseline;
            if (options.baselineFilter === 'LOWPASS') {
                baseline = lowPassFilter(smoothSignal(rawData, options.smoothWindowSize), options.baselineFilterOptions?.alpha);
            } else if (options.baselineFilter === 'MEAN') {
                baseline = meanFilter(smoothSignal(rawData, options.smoothWindowSize), options.baselineFilterOptions?.windowSize);
            } else if (options.baselineFilter === 'MEDIAN') {
                baseline = medianFilter(smoothSignal(rawData, options.smoothWindowSize), options.baselineFilterOptions?.windowSize);
            } else {
                throw new Error('Invalid baseline filter', typeof options.baselineFilter, options.baselineFilter, 'is not a valid filter function');
            }
            beat._baseline = baseline;
            baselineLeft = baseline.slice(0, rPeakIndex);
            baselineRight = baseline.slice(rPeakIndex);
            // console.log('baseVoltageLeft:', baselineLeft);
            // console.log('smoothLeft:', smoothLeft, leftTroughs, qPeakIndex);
            // console.log('baseVoltageRight:', baselineRight);
            // console.log('smoothRight:', smoothRight, rightTroughs, sPeakIndex);
            const threshold = 1 / 30;
            //get p wave
            let pWaveEndIndex = -1,
                pWaveStartIndex = -1;

            for (let i = 0; i < qPeakIndex; i++) {
                if (smoothLeft[i] && smoothLeft[i - 1] && smoothLeft[i][1] > smoothLeft[i - 1][1] && smoothLeft[i - 1][1] <= baselineLeft[i - 1][1] + threshold && smoothLeft[i][1] >= baselineLeft[i][1] + threshold) {
                    pWaveStartIndex = i;
                    break;
                }
            }
            for (let i = pWaveStartIndex; i < qPeakIndex; i++) {
                if (smoothLeft[i] && smoothLeft[i + 1] && smoothLeft[i][1] > smoothLeft[i + 1][1]) {

                    if (smoothLeft[i][1] >= baselineLeft[i][1] && smoothLeft[i][1] <= baselineLeft[i][1] + threshold && smoothLeft[i + 1][1] <= baselineLeft[i + 1][1] + threshold) {
                        pWaveEndIndex = i;
                        break;
                    }
                }
            }
            options.debug && console.log('pWaveStartIndex:', pWaveStartIndex, 'pWaveEndIndex:', pWaveEndIndex);
            if (pWaveEndIndex >= 0 && pWaveStartIndex >= 0 && pWaveStartIndex < pWaveEndIndex) {
                beat.p.start_time = left[pWaveStartIndex][0];
                beat.p.end_time = left[pWaveEndIndex][0];
                beat.p._data = left.slice(pWaveStartIndex, pWaveEndIndex);
                //get p wave peak
                let pWavePeakValue = Math.max.apply(null, smoothLeft.slice(pWaveStartIndex, pWaveEndIndex).map((val) => val[1]));
                let pWavePeakIndex = smoothLeft.findIndex((val) => val[1] === pWavePeakValue);
                options.debug && console.log('pWavePeakIndex:', pWavePeakIndex, pWavePeakValue, smoothLeft.slice(pWaveStartIndex, pWaveEndIndex).map((val) => val[1]));

                beat.p.peak_time = left[pWavePeakIndex][0];
                beat.p.peak_voltage = left[pWavePeakIndex][1];
            }

            //get q wave
            let qWaveStartIndex = -1;
            let qWavePeakIndex = qPeakIndex;
            let qWaveEndIndex = -1;
            //iterate left find q wave end
            for (let i = qPeakIndex; i >= 0; i--) {
                if (smoothLeft[i] && smoothLeft[i + 1] && smoothLeft[i][1] > smoothLeft[i + 1][1]) {
                    // console.log('pWaveEndIndex:', i, smoothLeft[i][1], smoothLeft[i + 1][1],'baseline:',baselineLeft[i][1],baselineLeft[i+1][1]);
                    // console.log('qWaveEndIndex:', i, smoothLeft[i][1], smoothLeft[i + 1][1], 'baseline:', baselineLeft[i][1], baselineLeft[i + 1][1]);
                    if (smoothLeft[i][1] >= baselineLeft[i][1] - threshold && smoothLeft[i + 1][1] <= baselineLeft[i + 1][1] - threshold) {
                        qWaveStartIndex = i;
                        break;
                    }
                }
            }
            for (let i = smoothLeft.length - 1; i >= qPeakIndex; i--) {
                if (smoothLeft[i] && smoothLeft[i + 1] && smoothLeft[i][1] < smoothLeft[i + 1][1]) {
                    // console.log('qWaveEndIndex:', i, smoothLeft[i][1], smoothLeft[i + 1][1], 'baseline:', baselineLeft[i][1], baselineLeft[i + 1][1]);
                    // console.log('qWaveEndIndex:', i, smoothLeft[i][1], smoothLeft[i + 1][1], 'baseline:', baselineLeft[i][1], baselineLeft[i + 1][1]);
                    if (smoothLeft[i][1] <= baselineLeft[i][1] - threshold && smoothLeft[i + 1][1] >= baselineLeft[i + 1][1] - threshold) {
                        qWaveEndIndex = i;
                        break;
                    }
                }
            }
            options.debug && console.log('qWaveStartIndex:', qWaveStartIndex, 'qWavePeakIndex:', qWavePeakIndex, 'qWaveEndIndex:', qWaveEndIndex);
            if (qWaveEndIndex >= 0 && qWaveStartIndex >= 0 && qWaveStartIndex < qWavePeakIndex) {
                beat.q.start_time = left[qWaveStartIndex][0];
                beat.q.end_time = left[qWaveEndIndex][0];
                beat.q._data = left.slice(qWaveStartIndex, qWaveEndIndex);
                beat.q.peak_time = left[qWavePeakIndex][0];
                beat.q.peak_voltage = left[qWavePeakIndex][1];
            }

            //get r wave
            let rWaveStartIndex = qWaveEndIndex;
            let rWaveEndIndex = -1;
            //iterate right find r wave end
            for (let i = 1; i < right.length; i++) {
                if (smoothRight[i] && smoothRight[i - 1] && smoothRight[i][1] < smoothRight[i - 1][1] && smoothRight[i][1] <= baselineRight[i][1]) {
                    rWaveEndIndex = i;
                    break;
                }
            }
            options.debug && console.log('rWaveStartIndex:', rWaveStartIndex, 'rWaveEndIndex:', rWaveEndIndex);
            if (rWaveStartIndex >= 0 && rWaveEndIndex >= 0 && rWaveEndIndex < sPeakIndex) {
                beat.r.start_time = left[rWaveStartIndex][0];
                beat.r.end_time = right[rWaveEndIndex][0];
                beat.r._data = [].concat(left.slice(rWaveStartIndex), right.slice(0, rWaveEndIndex));
            }

            //get s wave
            let sWaveStartIndex = rWaveEndIndex;
            let sWavePeakIndex = sPeakIndex;
            let sWaveEndIndex = -1;
            //iterate right find s wave end
            for (let i = sPeakIndex; i < right.length; i++) {
                if (smoothRight[i] && smoothRight[i - 1] && smoothRight[i][1] > smoothRight[i - 1][1] && smoothRight[i][1] >= baselineRight[i][1] - threshold && smoothRight[i - 1][1] <= baselineRight[i - 1][1] - threshold) {
                    sWaveEndIndex = i;
                    break;
                }
            }
            options.debug && console.log('sWaveStartIndex:', sWaveStartIndex, 'sWavePeakIndex:', sWavePeakIndex, 'sWaveEndIndex:', sWaveEndIndex);
            if (sWaveEndIndex >= 0 && sWavePeakIndex >= 0 && sWaveStartIndex < sWavePeakIndex) {
                beat.s.start_time = right[sWaveStartIndex][0];
                beat.s.end_time = right[sWaveEndIndex][0];
                beat.s._data = right.slice(sWaveStartIndex, sWaveEndIndex);
                beat.s.peak_time = right[sWavePeakIndex][0];
                beat.s.peak_voltage = right[sWavePeakIndex][1];
            }
            //get t wave
            let tWaveStartIndex = -1;
            let tWavePeakIndex = null;
            let tWaveEndIndex = -1;
            //iterate right find t wave end
            for (let i = sWaveEndIndex; i < right.length; i++) {
                if (smoothRight[i] && smoothRight[i - 1] && smoothRight[i][1] > smoothRight[i - 1][1] && smoothRight[i][1] >= baselineRight[i][1] + threshold && smoothRight[i - 1][1] <= baselineRight[i - 1][1] + threshold) {
                    tWaveStartIndex = i;
                    break;
                }
            }
            for (let i = right.length - 1; i >= 0; i--) {
                if (smoothRight[i] && smoothRight[i + 1] && smoothRight[i][1] > smoothRight[i + 1][1] && smoothRight[i][1] >= baselineRight[i][1] + threshold && smoothRight[i + 1][1] <= baselineRight[i + 1][1] + threshold) {
                    tWaveEndIndex = i;
                    break;
                }
            }
            options.debug && console.log('tWaveStartIndex:', tWaveStartIndex, 'tWavePeakIndex:', tWavePeakIndex, 'tWaveEndIndex:', tWaveEndIndex);
            if (tWaveStartIndex >= 0 && tWaveEndIndex >= 0 && tWaveStartIndex < tWaveEndIndex) {
                beat.t.start_time = right[tWaveStartIndex][0];
                beat.t.end_time = right[tWaveEndIndex][0];
                beat.t._data = right.slice(tWaveStartIndex, tWaveEndIndex);
                //get t wave peak
                let tWavePeakValue = Math.max.apply(null, smoothRight.slice(tWaveStartIndex, tWaveEndIndex).map((val) => val[1]));
                let tWavePeakIndex = smoothRight.findIndex((val) => val[1] === tWavePeakValue);
                options.debug && console.log('tWavePeakIndex:', tWavePeakIndex, tWavePeakValue, smoothRight.slice(tWaveStartIndex, tWaveEndIndex).map((val) => val[1]));

                beat.t.peak_time = right[tWavePeakIndex][0];
                beat.t.peak_voltage = right[tWavePeakIndex][1];
            }


        }
        return beats;
    }

    function testBeats(beats) {
        for (let beat of beats) {
            let p,
                q,
                r,
                s,
                t;
            p = beat.p.start_time >= 0 && beat.p.end_time >= 0 && beat.p.peak_time > 0;
            q = beat.q.start_time >= 0 && beat.q.end_time >= 0 && beat.q.peak_time > 0;
            r = beat.r.start_time >= 0 && beat.r.end_time >= 0 && beat.r.peak_time > 0;
            s = beat.s.start_time >= 0 && beat.s.end_time >= 0 && beat.s.peak_time > 0;
            t = beat.t.start_time >= 0 && beat.t.end_time >= 0 && beat.t.peak_time > 0;
            beat.valid = p && q && r && s && t;
        }
    }

    function getSummary(beats, frequency = 100, options) {
        let summary = {
            hr: null,
            st: 0,
            pr: 0,
            qrs: 0,
        };
        //get heart rate
        if (beats.length >= 2) {
            let duration = beats[beats.length - 1].r.peak_time - beats[0].r.peak_time;
            if (duration > 0) {
                summary.hr_duration = duration;
                if (options.useDirectData) {
                    //when use direct data, the duration is in 1/frequency second
                    summary.hr_duration = duration * (1000 / frequency);
                }
                summary.hr = Math.round(60 / (duration / 1000 / (beats.length - 1)));
            }
            summary.hr_beats = beats.length - 1;
        }
        //get st ,pr and QRS
        let st = [],
            pr = [],
            qrs = [];
        let validBeats = 0;
        for (let beat of beats) {
            if (beat.valid) {
                let stValid = false;
                if (beat.s.end_time > 0) {
                    let jPointIdx = beat._data.findIndex((val) => val[0] === beat.s.end_time);
                    let jPointVoltage = beat._data[jPointIdx][1];
                    let _80msAfterJPoint = jPointIdx + Math.floor(0.08 * frequency);
                    if (beat._data[_80msAfterJPoint]) {
                        let _80msVoltage = beat._data[_80msAfterJPoint][1];
                        // let _80msBaseline = beat._baseline[_80msAfterJPoint][1];
                        st.push(_80msVoltage - jPointVoltage);
                        stValid = true;
                    }

                }
                if (stValid) {
                    validBeats++
                    let pr_time = (beat.r.start_time - beat.p.start_time);
                    let qrs_time = (beat.s.end_time - beat.q.start_time);
                    if (options.useDirectData) {
                        //when use direct data, the duration is in 1/frequency second
                        pr_time = pr_time * 1000 / frequency
                        qrs_time = qrs_time * 1000 / frequency
                    }
                    pr.push(pr_time);
                    qrs.push(qrs_time);
                } else {
                    beat.valid = false;
                }
            }
        }
        if (st.length > 0) {
            summary.st = st.reduce((a, b) => a + b) / st.length;
        }
        if (pr.length > 0) {
            summary.pr = pr.reduce((a, b) => a + b) / pr.length;
        }
        if (qrs.length > 0) {
            summary.qrs = qrs.reduce((a, b) => a + b) / qrs.length;
        }
        summary.validBeats = validBeats;


        return summary;
    }

    function getSummaryFromSegments(segments) {
        let summary = {
            hr: null,
            st: 0,
            pr: 0,
            qrs: 0,
        };
        let hrSum = 0,
            hrBeats = 0;
        let stSum = 0,
            prSum = 0,
            qrsSum = 0;
        let validBeats = 0;
        for (let seg of segments) {
            if (seg.summary.hr_duration) {
                hrSum += seg.summary.hr_duration;
                hrBeats += seg.summary.hr_beats;
            }
            if (seg.summary.st) {
                stSum += seg.summary.st * seg.summary.validBeats;
            }
            if (seg.summary.pr) {
                prSum += seg.summary.pr * seg.summary.validBeats;
            }
            if (seg.summary.qrs) {
                qrsSum += seg.summary.qrs * seg.summary.validBeats;
            }
            validBeats += seg.summary.validBeats;
        }
        if (hrBeats > 0) {
            summary.hr = Math.round(60 / (hrSum / 1000 / hrBeats));
        }
        if (validBeats > 0) {
            summary.st = stSum / validBeats;
            summary.pr = prSum / validBeats;
            summary.qrs = qrsSum / validBeats;
        }
        return summary;

    }

    options = Object.assign({
        debug: false,
        aggregation: null,
        rPeakSlopeThreshold: 0.05,
        rPeakMinDistance: 30,
        smoothWindowSize: 5,
        baselineFilter: 'LOWPASS',
        baselineFilterOptions: {
            alpha: 0.05,
            windowSize: 20
        },
        throughMinDistance: 10,
        useDirectData: false,
    }, options || {});
    frequency = frequency || 100;
    //declare resultObj
    let aggregationRatio = options.aggregation || Math.floor(frequency / 100);
    if (!options.useDirectData) {
        ecgData = aggregation(ecgData, aggregationRatio);
    }
    frequency = frequency / aggregationRatio;
    let resultObj = new resultConstructor(ecgData, frequency, options);
    ecgData = resultObj._data;
    //splite data to segments
    let segments = splitData(ecgData);
    // console.log('segments:', segments);
    //iterate segments
    for (let seg of segments) {
        //get r-peaks
        let rPeaks = getRPeaks(seg, options);

        //get beats
        let beats = getBeats(rPeaks, seg, options);
        //wave of beats
        updateWaves(beats, options);
        //test beats is valid
        testBeats(beats);
        //get summary of beats
        let summary = getSummary(beats, frequency, options);
        resultObj._result.segments.push({
            start_time: seg[0][0],
            end_time: seg[seg.length - 1][0],
            summary: summary,
            beats: beats
        });

    }
    //get summary of all segments
    resultObj._result.summary = getSummaryFromSegments(resultObj._result.segments);
    return resultObj;
}

try {
    module.exports = {
        filters: {
            'LOWPASS': 'LOWPASS',
            'MEAN': 'MEAN',
            'MEDIAN': 'MEDIAN'
        },
        process: ecg_data_process_v1
    };
} catch (e) {
    console.error("module.exports is not defined");

    var global = global || window;
    global.ecg_data_process = {
        filters: {
            'LOWPASS': 'LOWPASS',
            'MEAN': 'MEAN',
            'MEDIAN': 'MEDIAN'
        },
        process: ecg_data_process_v1
    }
}

