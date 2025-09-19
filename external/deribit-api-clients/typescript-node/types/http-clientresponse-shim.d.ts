// Make the generated code's http.ClientResponse type compile on Node
declare module "http" {
  interface ClientResponse extends IncomingMessage { }
}
