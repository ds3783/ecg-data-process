import {
    expect
} from 'chai'
import {
    default as ecg_process
} from '../index.js'; // Adjust path if necessary
import fs
    from 'fs';
import path
    from 'path';

const process = ecg_process.process;
// const { expect } = chai;

describe('ECG Data Processor Tests', function () {
    it('should process data correctly', function () {
        const filePath = path.resolve('test/ecg.txt');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        let ecgData = fileContent.split('\n').map(line => {
            return line.trim() * 1;
        });
        let reducedData = [];
        //reduce data from 511.547 Hz to 100 Hz
        ecgData = ecgData.map((value, index) => {
            return [index / 511.547, value];
        });
        let offset = 0,
            limit = 1 / 100;
        for (let i = 0; i < 30 * 100; i++) {
            //group data by 0.1 second, total 30 seconds
            let dataGroup = [];
            //filter data between offset and limit
            dataGroup = ecgData.filter((value, index) => {
                return value[0] >= offset && value[0] < offset + limit;
            });
            let min,
                max,
                sum;
            if (dataGroup.length > 0) {
                min = Math.min(...dataGroup.map(item => item[1]));
                max = Math.max(...dataGroup.map(item => item[1]));
                sum = dataGroup.reduce((acc, item) => acc + item[1], 0);
            }
            if (dataGroup.length >= 3) {
                //if middle value is greater than head and tail  use max value
                if (dataGroup[1][1] > dataGroup[0][1] && dataGroup[dataGroup.length - 2][1] > dataGroup[dataGroup.length - 1][1]) {
                    reducedData.push(max);
                } else if (dataGroup[1][1] < dataGroup[0][1] && dataGroup[dataGroup.length - 2][1] < dataGroup[dataGroup.length - 1][1]) {
                    //if middle value is less than head and tail use min value
                    reducedData.push(min);
                } else {
                    //use avaerage value
                    reducedData.push(sum / dataGroup.length);
                }
            }
            offset += limit;
        }
        expect(reducedData).to.be.an('array');
        expect(reducedData.length).to.be.equal(3000);
        reducedData = reducedData.map((value, index) => {
            return [index, value];
        });
        const processedData = process(reducedData, 100,{useDirectData: true}); // Example function

        expect(processedData).to.be.an('object');
        let processedResult = processedData.getResult();
        expect(processedResult).to.be.an('object');
        expect(processedResult).to.have.property('summary');
        expect(processedResult.summary).to.have.property('hr');
        expect(processedResult.summary.hr).to.equal(81);
        expect(processedResult).to.have.property('segments');
        console.log(processedResult.summary);
        console.log(processedResult.segments[0].beats[0]);
    });
});