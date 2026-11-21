
class MicProcessor extends AudioWorkletProcessor {
    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];

        if (input && input[0]) {
            // Send microphone samples to the main React thread.
            this.port.postMessage(input[0].slice(0));
        }

        // Produce silent output. This keeps the worklet active
        // without playing microphone audio through the speakers.
        if (output) {
            for (const channel of output) {
                channel.fill(0);
            }
        }

        return true;
    }
}

registerProcessor("mic-processor", MicProcessor);
