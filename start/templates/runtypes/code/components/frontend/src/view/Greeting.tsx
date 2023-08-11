import { useState, useCallback } from "react";
import * as tyras from "@ty-ras/frontend-fetch-runtypes";
import * as task from "../hooks/asyncFailableTask";
import backend from "../services/backend";

const Greeting = () => {
  const [target, setTarget] = useState("world");
  const [{ input, result }, setResult] = useState<TaskResult>({
    input: target,
  });
  const { invokeTask } = task.useAsyncFailableTask(
    useCallback(async (target: string) => {
      // Execute backend call, catching any thrown exceptions, and ending up in TaskEither<Error, tyras.APICallResult<T>>
      const beResult = await backend.greeting.getGreeting({ url: { target } });
      if (beResult.error === "none") {
        setResult({ input: target, result: beResult.data });
      } else {
        throw tyras.toError(beResult);
      }
    }, []),
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
