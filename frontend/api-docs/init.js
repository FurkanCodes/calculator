// Starts Swagger UI on the API description. It is a separate file, not an
// inline script, so the page works under a CSP that allows scripts from this
// origin only.
SwaggerUIBundle({
  url: '/api/v1/openapi.json',
  dom_id: '#swagger-ui',
  presets: [SwaggerUIBundle.presets.apis],
  // The API reference only: no top bar for loading another document.
  layout: 'BaseLayout',
  deepLinking: true,
  // Never send the document to validator.swagger.io.
  validatorUrl: null,
})
