import { function as F, either as E, taskEither as TE } from "fp-ts";
import { useState, useCallback } from "react";
import * as tyras from "@ty-ras/frontend-__TYRAS_CLIENT__-io-ts";
import * as task from "../hooks/asyncFailableTask";
import backend from "../services/backend";

const Greeting = () => {
  const [target, setTarget] = useState("world");
  const [{ input, result }, setResult] = useState<TaskResult>({
    input: target,
  });
  const { invokeTask } = task.useAsyncFailableTask(
    useCallback(
      (target: string) =>
        F.pipe(
          // Execute backend call, catching any thrown exceptions, and ending up in TaskEither<Error, tyras.APICallResult<T>>
          TE.tryCatch(
            async () => await backend.greeting.getGreeting({ url: { target } }),
            E.toError,
          ),
          // Transform TaskEither<Error, tyras.APICallResult<T>> into TaskEither<tyras.APICallResultError, T>>
          TE.chainEitherKW(tyras.toEither),
          // If backend call was successful, react on result
          TE.map((greetingFromBackend) =>
            setResult({ input: target, result: greetingFromBackend }),
          ),
        ),
      [],
    ),
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
