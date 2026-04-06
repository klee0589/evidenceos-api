const { v4: uuidv4 } = require("uuid");

const ERROR_TYPES = {
  400: "validation_error",
  401: "auth_error",
  403: "permission_error",
  404: "not_found",
  409: "conflict",
  429: "rate_limit_error",
  500: "api_error",
  502: "gateway_error",
  503: "service_unavailable",
};

module.exports = function requestContext(req, res, next) {
  const requestId = "req_" + uuidv4().replace(/-/g, "").slice(0, 16);
  const startTime = Date.now();

  req.requestId = requestId;
  req._startTime = startTime;
  res.setHeader("X-Request-Id", requestId);

  // Patch res.json to standardize all responses
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    // Don't double-wrap (used internally to bypass wrapping)
    if (body?.__raw) {
      const { __raw, ...rest } = body;
      return originalJson(rest);
    }

    const responseTimeMs = Date.now() - startTime;
    const plan = req.apiKey?.plan || "public";
    const meta = { api_version: "v1", plan, response_time_ms: responseTimeMs };

    let wrapped;
    if (typeof body?.error === "string") {
      const { error: message, ...extra } = body;
      wrapped = {
        request_id: requestId,
        error: {
          message,
          type: ERROR_TYPES[res.statusCode] || "api_error",
          code: res.statusCode,
          ...(Object.keys(extra).length ? { details: extra } : {}),
        },
        meta,
      };
    } else {
      wrapped = {
        request_id: requestId,
        data: body,
        meta,
      };
    }

    return originalJson(wrapped);
  };

  // Structured JSON logging for every request
  res.on("finish", () => {
    const ms = Date.now() - startTime;
    const key = req.apiKey?.key_prefix
      ? `${req.apiKey.key_prefix}...`
      : "public";
    process.stdout.write(
      JSON.stringify({
        request_id: requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        response_ms: ms,
        api_key: key,
        ts: new Date().toISOString(),
      }) + "\n"
    );
  });

  next();
};
