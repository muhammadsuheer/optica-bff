/**
 * OpenAPI Documentation Generator
 * 
 * Generates OpenAPI 3.0 specification for all public routes.
 */

// =======================
// OpenAPI Specification
// =======================

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Optia BFF API',
    description: 'Backend for Frontend API with WooCommerce Store API proxy and PayFast integration',
    version: '1.0.0',
    contact: {
      name: 'Optia Team',
      email: 'support@optia.com'
    }
  },
  servers: [
    {
      url: 'https://api.optia.com',
      description: 'Production server'
    },
    {
      url: 'https://staging-api.optia.com',
      description: 'Staging server'
    }
  ],
  security: [
    {
      ApiKey: []
    }
  ],
  components: {
    securitySchemes: {
      ApiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication'
      },
      WebhookSignature: {
        type: 'apiKey',
        in: 'header',
        name: 'X-WC-Webhook-Signature',
        description: 'WooCommerce HMAC signature'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR'
              },
              message: {
                type: 'string',
                example: 'Invalid request data'
              },
              details: {
                type: 'object',
                additionalProperties: true
              },
              traceId: {
                type: 'string',
                example: 'abc123-def456-ghi789'
              },
              timestamp: {
                type: 'string',
                format: 'date-time'
              }
            },
            required: ['code', 'message', 'timestamp']
          }
        },
        required: ['error']
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          wc_id: { type: 'integer', example: 123 },
          name: { type: 'string', example: 'Sample Product' },
          slug: { type: 'string', example: 'sample-product' },
          description: { type: 'string', example: 'Product description' },
          short_description: { type: 'string', example: 'Short description' },
          price: { type: 'number', format: 'float', example: 29.99 },
          regular_price: { type: 'number', format: 'float', example: 39.99 },
          sale_price: { type: 'number', format: 'float', example: 29.99, nullable: true },
          on_sale: { type: 'boolean', example: true },
          status: { type: 'string', example: 'publish' },
          featured: { type: 'boolean', example: false },
          stock_status: { type: 'string', example: 'instock' },
          stock_quantity: { type: 'integer', example: 100, nullable: true },
          images: {
            type: 'array',
            items: { type: 'string' },
            example: ['https://example.com/image1.jpg']
          },
          categories: {
            type: 'array',
            items: { type: 'string' },
            example: ['Electronics', 'Gadgets']
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['new', 'featured']
          },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'wc_id', 'name', 'slug', 'price', 'status']
      },
      Cart: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                id: { type: 'integer' },
                name: { type: 'string' },
                quantity: { type: 'integer' },
                price: { type: 'number' },
                total: { type: 'number' }
              }
            }
          },
          totals: {
            type: 'object',
            properties: {
              subtotal: { type: 'number' },
              tax: { type: 'number' },
              total: { type: 'number' },
              items_count: { type: 'integer' }
            }
          }
        }
      },
      Checkout: {
        type: 'object',
        properties: {
          billing_address: {
            type: 'object',
            properties: {
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              company: { type: 'string' },
              address_1: { type: 'string' },
              address_2: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              postcode: { type: 'string' },
              country: { type: 'string' },
              email: { type: 'string', format: 'email' },
              phone: { type: 'string' }
            }
          },
          shipping_address: {
            type: 'object',
            properties: {
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              company: { type: 'string' },
              address_1: { type: 'string' },
              address_2: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              postcode: { type: 'string' },
              country: { type: 'string' }
            }
          },
          payment_method: { type: 'string', example: 'payfast' }
        }
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          status: { type: 'string' },
          total: { type: 'number' },
          currency: { type: 'string' },
          payment_method: { type: 'string' },
          billing_address: { type: 'object' },
          shipping_address: { type: 'object' },
          created_at: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  paths: {
    '/store': {
      get: {
        summary: 'Store API Information',
        description: 'Get information about the Store API endpoints and features',
        tags: ['Store'],
        responses: {
          '200': {
            description: 'Store API information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    version: { type: 'string' },
                    description: { type: 'string' },
                    endpoints: { type: 'object' },
                    features: { type: 'object' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/store/products': {
      get: {
        summary: 'List Products',
        description: 'Get paginated list of products with filtering options',
        tags: ['Store', 'Products'],
        parameters: [
          {
            name: 'Cart-Token',
            in: 'header',
            schema: { type: 'string' },
            description: 'Woo Store API cart token',
            required: false
          },
          {
            name: 'Idempotency-Key',
            in: 'header',
            schema: { type: 'string' },
            description: 'Idempotency for safe retries',
            required: false
          },
          {
            name: 'page',
            in: 'query',
            description: 'Page number',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 1 }
          },
          {
            name: 'per_page',
            in: 'query',
            description: 'Items per page',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          },
          {
            name: 'search',
            in: 'query',
            description: 'Search term',
            schema: { type: 'string' }
          },
          {
            name: 'category',
            in: 'query',
            description: 'Category filter',
            schema: { type: 'string' }
          },
          {
            name: 'min_price',
            in: 'query',
            description: 'Minimum price',
            schema: { type: 'number', minimum: 0 }
          },
          {
            name: 'max_price',
            in: 'query',
            description: 'Maximum price',
            schema: { type: 'number', minimum: 0 }
          },
          {
            name: 'orderby',
            in: 'query',
            description: 'Sort order',
            schema: {
              type: 'string',
              enum: ['date', 'price', 'popularity', 'rating', 'title'],
              default: 'date'
            }
          },
          {
            name: 'on_sale',
            in: 'query',
            description: 'Filter on-sale products',
            schema: { type: 'boolean' }
          }
        ],
        responses: {
          '200': {
            description: 'Products list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    products: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Product' }
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        per_page: { type: 'integer' },
                        total: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '429': { $ref: '#/components/responses/RateLimitExceeded' },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/store/products/{id}': {
      get: {
        summary: 'Get Product Details',
        description: 'Get detailed information about a specific product',
        tags: ['Store', 'Products'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Product ID',
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Product details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    product: { $ref: '#/components/schemas/Product' }
                  }
                }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/store/cart': {
      get: {
        summary: 'Get Cart',
        description: 'Get current cart contents',
        tags: ['Store', 'Cart'],
        responses: {
          '200': {
            description: 'Cart contents',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    cart: { $ref: '#/components/schemas/Cart' },
                    cart_token: { type: 'string' }
                  }
                }
              }
            }
          },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      },
      delete: {
        summary: 'Clear Cart',
        description: 'Clear all items from cart',
        tags: ['Store', 'Cart'],
        responses: {
          '200': {
            description: 'Cart cleared',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    cart: { $ref: '#/components/schemas/Cart' },
                    cart_token: { type: 'string' }
                  }
                }
              }
            }
          },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/store/cart/add-item': {
      post: {
        summary: 'Add Item to Cart',
        description: 'Add a product to the cart',
        tags: ['Store', 'Cart'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'integer', description: 'Product ID' },
                  quantity: { type: 'integer', minimum: 1, maximum: 999 },
                  variation_id: { type: 'integer', description: 'Product variation ID' },
                  variation: { type: 'object', description: 'Variation attributes' }
                },
                required: ['id', 'quantity']
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Item added to cart',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    cart: { $ref: '#/components/schemas/Cart' },
                    cart_token: { type: 'string' }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '429': { $ref: '#/components/responses/RateLimitExceeded' },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/store/cart/items': {
      put: {
        summary: 'Update Cart Items',
        description: 'Update quantities of cart items',
        tags: ['Store', 'Cart'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        key: { type: 'string' },
                        quantity: { type: 'integer', minimum: 0, maximum: 999 }
                      },
                      required: ['key', 'quantity']
                    }
                  }
                },
                required: ['items']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Cart items updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    cart: { $ref: '#/components/schemas/Cart' },
                    cart_token: { type: 'string' }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '429': { $ref: '#/components/responses/RateLimitExceeded' },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/store/cart/remove-item': {
      post: {
        summary: 'Remove Item from Cart',
        description: 'Remove a specific item from the cart',
        tags: ['Store', 'Cart'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  key: { type: 'string', description: 'Cart item key' }
                },
                required: ['key']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Item removed from cart',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    cart: { $ref: '#/components/schemas/Cart' },
                    cart_token: { type: 'string' }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '429': { $ref: '#/components/responses/RateLimitExceeded' },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/store/checkout': {
      get: {
        summary: 'Get Checkout',
        description: 'Get checkout draft with current cart',
        tags: ['Store', 'Checkout'],
        responses: {
          '200': {
            description: 'Checkout draft',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    checkout: { $ref: '#/components/schemas/Checkout' },
                    cart_token: { type: 'string' }
                  }
                }
              }
            }
          },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      },
      put: {
        summary: 'Update Checkout',
        description: 'Update checkout addresses and payment method',
        tags: ['Store', 'Checkout'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  billing_address: { $ref: '#/components/schemas/Checkout' },
                  shipping_address: { $ref: '#/components/schemas/Checkout' },
                  payment_method: { type: 'string' },
                  shipping_method: { type: 'string' },
                  customer_note: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Checkout updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    checkout: { $ref: '#/components/schemas/Checkout' },
                    cart_token: { type: 'string' }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '429': { $ref: '#/components/responses/RateLimitExceeded' },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      },
      post: {
        summary: 'Process Checkout',
        description: 'Process checkout and create order',
        tags: ['Store', 'Checkout'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  payment_method: { type: 'string', example: 'payfast' },
                  payment_data: { type: 'object' }
                },
                required: ['payment_method']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Order created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    order: { $ref: '#/components/schemas/Order' },
                    redirect_url: { type: 'string', description: 'Payment redirect URL (if applicable)' },
                    cart_token: { type: 'string' }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '429': { $ref: '#/components/responses/RateLimitExceeded' },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/payments/payfast/start': {
      post: {
        summary: 'Start PayFast Payment',
        description: 'Create order and get PayFast payment URL',
        tags: ['Payments', 'PayFast'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  billing_address: { $ref: '#/components/schemas/Checkout' },
                  shipping_address: { $ref: '#/components/schemas/Checkout' },
                  payment_method: { type: 'string', enum: ['payfast'], default: 'payfast' }
                },
                required: ['billing_address']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Payment started',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    order_id: { type: 'integer' },
                    redirect_url: { type: 'string' },
                    cart_token: { type: 'string' }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '429': { $ref: '#/components/responses/RateLimitExceeded' },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/payments/payfast/return': {
      get: {
        summary: 'PayFast Return',
        description: 'Handle PayFast payment return',
        tags: ['Payments', 'PayFast'],
        parameters: [
          {
            name: 'm_payment_id',
            in: 'query',
            description: 'Merchant payment ID',
            schema: { type: 'string' }
          },
          {
            name: 'pf_payment_id',
            in: 'query',
            description: 'PayFast payment ID',
            schema: { type: 'string' }
          },
          {
            name: 'payment_status',
            in: 'query',
            description: 'Payment status',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Return page with deep-link',
            content: {
              'text/html': {
                schema: { type: 'string' }
              }
            }
          },
          '400': {
            description: 'Invalid return',
            content: {
              'text/html': {
                schema: { type: 'string' }
              }
            }
          }
        }
      }
    },
    '/payments/payfast/itn': {
      post: {
        summary: 'PayFast ITN',
        description: 'Handle PayFast Instant Transaction Notification',
        tags: ['Payments', 'PayFast'],
        requestBody: {
          required: true,
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                additionalProperties: { type: 'string' }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'ITN processed',
            content: {
              'text/plain': {
                schema: { type: 'string', example: 'OK' }
              }
            }
          },
          '400': {
            description: 'Invalid ITN',
            content: {
              'text/plain': {
                schema: { type: 'string', example: 'INVALID' }
              }
            }
          },
          '500': {
            description: 'ITN processing error',
            content: {
              'text/plain': {
                schema: { type: 'string', example: 'ERROR' }
              }
            }
          }
        }
      }
    },
    '/webhooks/woo': {
      post: {
        summary: 'WooCommerce Webhook',
        description: 'Handle WooCommerce webhook events',
        tags: ['Webhooks'],
        security: [{ WebhookSignature: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Webhook processed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    messageId: { type: 'string' },
                    processingTime: { type: 'integer' }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/ops/replay/{id}': {
      post: {
        summary: 'Replay DLQ Record',
        description: 'Replay a failed job from the Dead Letter Queue',
        tags: ['Operations'],
        security: [{ ApiKey: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'DLQ record ID',
            schema: { type: 'integer' }
          }
        ],
        responses: {
          '200': {
            description: 'Job replayed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    record: { type: 'object' }
                  }
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '429': { $ref: '#/components/responses/RateLimitExceeded' },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/docs/openapi.json': {
      get: {
        summary: 'OpenAPI Specification',
        description: 'Get the OpenAPI 3.0 specification for this API',
        tags: ['Documentation'],
        responses: {
          '200': {
            description: 'OpenAPI specification',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  description: 'OpenAPI 3.0 specification'
                }
              }
            }
          }
        }
      }
    },
    responses: {
      BadRequest: {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      Unauthorized: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      NotFound: {
        description: 'Not Found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      InternalError: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      RateLimitExceeded: {
        description: 'Rate limit exceeded',
        headers: {
          'X-RateLimit-Limit': { 
            schema: { type: 'integer' },
            description: 'Rate limit per window'
          },
          'X-RateLimit-Remaining': { 
            schema: { type: 'integer' },
            description: 'Remaining requests in current window'
          }
        },
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'Store',
      description: 'WooCommerce Store API proxy endpoints'
    },
    {
      name: 'Products',
      description: 'Product catalog operations'
    },
    {
      name: 'Cart',
      description: 'Shopping cart operations'
    },
    {
      name: 'Checkout',
      description: 'Checkout and order processing'
    },
    {
      name: 'Payments',
      description: 'Payment processing'
    },
    {
      name: 'PayFast',
      description: 'PayFast payment gateway integration'
    },
    {
      name: 'Webhooks',
      description: 'Webhook event handling'
    },
    {
      name: 'Operations',
      description: 'Administrative operations'
    },
    {
      name: 'Documentation',
      description: 'API documentation'
    }
  ]
}

// =======================
// Export
// =======================

export default openApiSpec
