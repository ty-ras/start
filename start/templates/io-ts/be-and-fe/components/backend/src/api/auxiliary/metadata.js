export const mdArgsBase = (output, operation) => ({
    urlParameters: undefined,
    queryParameters: undefined,
    requestHeaders: undefined,
    body: undefined,
    responseHeaders: undefined,
    output: {
        description: output.description,
        mediaTypes: {
            "application/json": {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                example: output.example,
            },
        },
    },
    operation,
});
