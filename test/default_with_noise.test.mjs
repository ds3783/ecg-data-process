import {
    expect
} from 'chai'
import {
    default as ecg_process
} from '../index.js'; // Adjust path if necessary
import fs from 'fs';
import path from 'path';

const process = ecg_process.process;
// const { expect } = chai;

describe('ECG Data Processor Tests', function () {
    it('should process data correctly', function () {
        const filePath = path.resolve('test/ecg.txt');
        const fileContent =  fs.readFileSync(filePath, 'utf-8');
        const ecgData = fileContent.split('\n').map(line => {
            return line.trim() * 1;
        });
        const processedData = process(ecgData,511.547,{
            aggregation: 500,
        }); // Example function

        expect(processedData).to.be.an('object');
        let processedResult=processedData.getResult();
        expect(processedResult).to.be.an('object');
        expect(processedResult).to.have.property('summary');
        expect(processedResult).to.have.property('segments');
        console.log(processedResult.summary);
        console.log(processedResult.segments[0].beats[0]);
    });
});