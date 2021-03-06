import { RequestMethod } from '@nestjs/common';
import { ErrorHandler, HttpServer, RequestHandler } from '@nestjs/common/interfaces';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { NestApplicationOptions } from '@nestjs/common/interfaces/nest-application-options.interface';
import { loadPackage } from '@nestjs/common/utils/load-package.util';
import { AbstractHttpAdapter } from '@nestjs/core/adapters/http-adapter';
import * as http from 'http';
import * as https from 'https';
import * as Koa from 'koa';
import { Key, pathToRegexp } from 'path-to-regexp';
import * as Stream from 'stream';
import { ViewsOptions } from '../interfaces/views-options.interface';

// Only used for typing
import * as koaCors from '@koa/cors';
import * as koaMount from 'koa-mount';
import * as koaViews from 'koa-views';
import * as koaBodyParser from 'koa-bodyparser';
import * as koaStatic from 'koa-static';

export class KoaAdapter extends AbstractHttpAdapter<http.Server, Koa.Request, Koa.Response> implements HttpServer {
  protected readonly instance: Koa;

  constructor(instance: Koa = new Koa()) {
    super(instance);
    this.instance = instance;
  }

  public use(handler: RequestHandler<Koa.Request, Koa.Response> | ErrorHandler<Koa.Request, Koa.Response>): Koa;
  public use(path: string, handler: RequestHandler<Koa.Request, Koa.Response> | ErrorHandler<Koa.Request, Koa.Response>): Koa;
  /* istanbul ignore next */
  public use(...args: any[]): Koa { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (typeof args[0] === 'string') {
      return this.useMethodPath('ALL', args[0], args[1] as RequestHandler<Koa.Request, Koa.Response>);
    } else {
      return this.useMethodPath('ALL', null, args[0] as RequestHandler<Koa.Request, Koa.Response>);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get(...args: any[]): Koa {
    return this.useMethod('GET', ...args);
  }

  /* istanbul ignore next */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public post(...args: any[]): Koa {
    return this.useMethod('POST', ...args);
  }

  /* istanbul ignore next */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public head(...args: any[]): Koa {
    return this.useMethod('HEAD', ...args);
  }

  /* istanbul ignore next */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public delete(...args: any[]): Koa {
    return this.useMethod('DELETE', ...args);
  }

  /* istanbul ignore next */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public put(...args: any[]): Koa {
    return this.useMethod('PUT', ...args);
  }

  /* istanbul ignore next */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public patch(...args: any[]): Koa {
    return this.useMethod('PATCH', ...args);
  }

  /* istanbul ignore next */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public options(...args: any[]): Koa {
    return this.useMethod('OPTIONS', ...args);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public reply(response: Koa.Response, body: any, statusCode?: number) {
    if (statusCode) {
      response.status = statusCode;
    }
    response.body = body;

    // Disable Koa's response handling so we can handle it ourselves
    response.ctx.respond = false;

    // based on https://github.com/koajs/koa/blob/422e539e8989e65ba43ecc39ddbaa3c4f755d465/lib/application.js#L214
    const ctx = response.ctx;
    const res = ctx.res;
    if (!ctx.writable) {
      return;
    }

    const code = ctx.status;

    // status body
    if (null === body || undefined === body) {
      if (ctx.req.httpVersionMajor >= 2) {
        body = String(code);
      } else {
        body = ctx.message || String(code);
      }
      if (!res.headersSent) {
        ctx.type = 'text';
        ctx.length = Buffer.byteLength(body);
      }
      return res.end(body);
    }

    // responses
    if (Buffer.isBuffer(body)) {
      return res.end(body);
    }
    if ('string' === typeof body) {
      return res.end(body);
    }
    if (body instanceof Stream) {
      return body.pipe(res);
    }

    // body: json
    body = JSON.stringify(body);
    if (!res.headersSent) {
      ctx.length = Buffer.byteLength(body);
    }
    res.end(body);
  }

  public status(response: Koa.Response, statusCode: number) {
    return response.status = statusCode;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async render(response: Koa.Response, view: string, options: any) {
    const ctx = response.ctx;
    try {
      await ctx.render(view, options);
    } catch (e) {
      response.ctx.app.emit('error', e, response.ctx);
      return;
    }
    this.reply(response, response.body);
  }

  public redirect(response: Koa.Response, statusCode: number, url: string) {
    response.status = statusCode;
    response.redirect(url);
    response.res.end();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setErrorHandler(handler: (err: any, req: Koa.Request, res: Koa.Response) => void) {
    return this.getInstance<Koa>().on('error', (err, ctx?: Koa.Context) => handler(err, ctx && ctx.request, ctx && ctx.response));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setNotFoundHandler(handler: (req: Koa.Request, res: Koa.Response) => void) {
    return this.getInstance<Koa>().use(async (ctx, next) => {
      try {
        await next();
        const status = ctx.status || 404;
        if (status === 404) {
          ctx.throw(404);
        }
      } catch (err) {
        if (ctx.status === 404) {
          handler(ctx.request, ctx.response);
        }
      }
    });
  }

  public setHeader(response: Koa.Response, name: string, value: string) {
    return response.set(name, value);
  }

  public listen(port: string | number, callback?: () => void): http.Server;
  public listen(port: string | number, hostname: string, callback?: () => void): http.Server;
  /* istanbul ignore next */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public listen(port: any, ...args: any[]): http.Server {
    return this.httpServer.listen(port, ...args);
  }

  public close() {
    return this.httpServer ? this.httpServer.close() : undefined;
  }

  public useStaticAssets(root: string, opts?: koaStatic.Options & { prefix?: string }) {
    const serve: typeof koaStatic = loadPackage('koa-static', 'KoaAdapter.useStaticAssets()', () => require('koa-static'));
    let serveMiddleware = serve(root, opts);
    if (opts.prefix) {
      const mount: typeof koaMount = loadPackage('koa-mount', 'KoaAdapter.useStaticAssets()', () => require('koa-mount'));
      serveMiddleware = mount(opts.prefix, serveMiddleware);
    }
    this.getInstance<Koa>().use(serveMiddleware);
    return this;
  }

  public setViewEngine(opts: any): this { // eslint-disable-line @typescript-eslint/no-explicit-any
    const options = opts as ViewsOptions;
    const views: typeof koaViews = loadPackage('koa-views', 'KoaAdapter.setViewEngine()', () => require('koa-views'));
    const modifiedOpts = Object.assign({}, options, { autoRender: true });
    this.getInstance<Koa>().use(views(modifiedOpts.dir, modifiedOpts));
    return this;
  }

  public getRequestMethod(request: Koa.Request): string {
    return request.method;
  }

  public getRequestUrl(request: Koa.Request): string {
    return request.url;
  }

  public getRequestHostname(request: Koa.Request): string {
    return request.hostname;
  }

  public enableCors(options: CorsOptions) {
    const cors: typeof koaCors = loadPackage('@koa/cors', 'KoaAdapter.enableCors()', () => require('@koa/cors'));
    if (typeof options.origin === 'function') {
      throw new Error('Not implemented');
    }
    this.getInstance<Koa>().use(cors({
      ...options,
      origin: (ctx: Koa.Context) => {
        if (typeof options.origin === 'string') {
          return options.origin;
        }
        const requestOrigin = ctx.headers.origin || '';
        if (options.origin instanceof RegExp) {
          return options.origin.test(requestOrigin) ? requestOrigin : '';
        }
        if (Array.isArray(options.origin)) {
          if (options.origin.some(origin => {
            if (origin instanceof RegExp) {
              return origin.test(requestOrigin);
            } else {
              return origin === requestOrigin;
            }
          })) {
            return requestOrigin;
          }
        }
        if (options.origin === true) {
          return requestOrigin;
        }
        return false;
      },
      exposeHeaders: options.exposedHeaders,
      allowHeaders: options.allowedHeaders,
      allowMethods: options.methods,
    }));
  }

  public createMiddlewareFactory(
    requestMethod: RequestMethod,
  ): (path: string, callback: Function) => Koa { // tslint:disable-line ban-types
    return (path: string, callback: Function) => { // tslint:disable-line ban-types
      return this.useMethodMiddleware(RequestMethod[requestMethod], path, callback);
    };
  }

  public initHttpServer(options: NestApplicationOptions) {
    const isHttpsEnabled = options && options.httpsOptions;
    /* istanbul ignore if */
    if (isHttpsEnabled) {
      this.httpServer = https.createServer(
        isHttpsEnabled,
        this.getInstance<Koa>().callback(),
      );
      return;
    }
    this.httpServer = http.createServer(this.getInstance<Koa>().callback());
  }

  public registerParserMiddleware() {
    const bodyParser: typeof koaBodyParser = loadPackage('koa-body-parser', 'KoaAdapter.registerParserMiddleware()', () => require('koa-bodyparser'));
    return this.getInstance<Koa>().use(bodyParser());
  }

  public getType(): string {
    return 'koa';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private useMethodPath(method: string, path: any, handler: RequestHandler, middleware?: boolean) {
    let re: RegExp;
    const keys: Key[] = [];
    let normalizedPath: string;
    if (path) {
      re = pathToRegexp(path, keys);
      normalizedPath = path === '/*' ? '' : path;
    }
    return this.getInstance<Koa>().use(async (ctx, next) => {
      const queryParamsIndex = ctx.originalUrl.indexOf('?');
      const pathname =
        queryParamsIndex >= 0
          ? ctx.originalUrl.slice(0, queryParamsIndex)
          : ctx.originalUrl;

      const params: { [key: string]: string } = {};
      if (path) {
        const matches = re.exec(pathname + '/');
        if (!matches && normalizedPath) {
          await next();
          return;
        }

        if (matches) {
          matches.slice(1).forEach((match, index) => {
            const key = keys[index];
            params[key.name] = decodeURIComponent(match);
          });
        }
      }

      if (
        method === 'ALL' ||
        ctx.method === method
      ) {
        if (!middleware) {
          // Disable Koa's response handling when this is a Nest route
          ctx.respond = false;
        }
        return handler(Object.assign(ctx.request, { params }), ctx.response, next);
      }
      await next();
      return;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private useMethod(method: string, ...args: any[]): Koa {
    if (typeof args[0] === 'string') {
      return this.useMethodPath(method, args[0], args[1]);
    } else {
      return this.useMethodPath(method, null, args[0]);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private useMethodMiddleware(method: string, ...args: any[]): Koa {
    if (typeof args[0] === 'string') {
      return this.useMethodPath(method, args[0], args[1], true);
    } else {
      return this.useMethodPath(method, null, args[0], true);
    }
  }
}
