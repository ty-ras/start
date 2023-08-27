import { useState, useCallback } from "react";
import * as task from "../hooks/asyncFailableTask";
import backend from "../services/backend";

const Greeting = () => {
  const [target, setTarget] = useState("world");
  const [{ input, result }, setResult] = useState<TaskResult>({
    input: target,
  });
  const { invokeTask } = task.useAsyncAPICall(
    useCallback(
      async (target: string) =>
        await backend.greeting.getGreeting({ url: { target } }),
      [],
    ),
    useCallback((result, target) => setResult({ input: target, result }), []),
  );
  return (
    <>
      <p>
        Hello,{" "}
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onBlur={() => {
            if (target !== input) {
              setResult({ input: target });
              invokeTask(target);
            }
          }}
        />
      </p>
      {result && (
        <p>
          Backend returned <code>{result}</code>
        </p>
      )}
    </>
  );
};

export default Greeting;

interface TaskResult {
  input: string;
  result?: string;
}
