// In its own file because the CSP allows no inline scripts.
SwaggerUIBundle({
  url: '/api/v1/openapi.json',
  dom_id: '#swagger-ui',
  presets: [SwaggerUIBundle.presets.apis],
  // No top bar for loading another document.
  layout: 'BaseLayout',
  deepLinking: true,
  // Never send the document to validator.swagger.io.
  validatorUrl: null,
})
