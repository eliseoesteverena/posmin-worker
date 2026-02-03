export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Validar que DB está disponible
    if (!env.pos_db) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    try {
      // GET /productos - Listar todos
      if (path === '/productos' && method === 'GET') {
        const { results } = await env.pos_db.prepare('SELECT * FROM productos ORDER BY created_at DESC').all();
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // GET /productos/:id - Obtener uno
      if (path.startsWith('/productos/') && method === 'GET') {
        const id = path.split('/')[2];
        const result = await env.pos_db.prepare('SELECT * FROM productos WHERE id = ?').bind(id).first();
        if (!result) {
          return new Response(JSON.stringify({ error: 'Producto no encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // POST /productos/validate/nombre - Validar nombre único
      if (path === '/productos/validate/nombre' && method === 'POST') {
        const { nombre, excludeId } = await request.json();
        let query = 'SELECT id FROM productos WHERE nombre = ?';
        const params = [nombre];
        if (excludeId) {
          query += ' AND id != ?';
          params.push(excludeId);
        }
        const result = await env.pos_db.prepare(query).bind(...params).first();
        return new Response(JSON.stringify({ exists: !!result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // POST /productos/validate/sku - Validar SKU único
      if (path === '/productos/validate/sku' && method === 'POST') {
        const { sku, excludeId } = await request.json();
        let query = 'SELECT id FROM productos WHERE codigo_interno_sku = ?';
        const params = [sku];
        if (excludeId) {
          query += ' AND id != ?';
          params.push(excludeId);
        }
        const result = await env.pos_db.prepare(query).bind(...params).first();
        return new Response(JSON.stringify({ exists: !!result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // POST /productos - Crear nuevo
      if (path === '/productos' && method === 'POST') {
        const data = await request.json();
        
        if (!data.nombre || !data.codigo_interno_sku || !data.precio_unitario) {
          return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        if (data.precio_unitario <= 0) {
          return new Response(JSON.stringify({ error: 'El precio debe ser mayor a 0' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const nombreExists = await env.pos_db.prepare('SELECT id FROM productos WHERE nombre = ?').bind(data.nombre).first();
        if (nombreExists) {
          return new Response(JSON.stringify({ error: 'El nombre ya existe' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const skuExists = await env.pos_db.prepare('SELECT id FROM productos WHERE codigo_interno_sku = ?').bind(data.codigo_interno_sku).first();
        if (skuExists) {
          return new Response(JSON.stringify({ error: 'El SKU ya existe' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const result = await env.pos_db.prepare(
          'INSERT INTO productos (nombre, descripcion, codigo_interno_sku, stock_disponible, habilitar_stock, precio_unitario) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
          data.nombre,
          data.descripcion || null,
          data.codigo_interno_sku,
          data.stock_disponible || 0,
          data.habilitar_stock ? 1 : 0,
          data.precio_unitario
        ).run();
        
        return new Response(JSON.stringify({ id: result.meta.last_row_id, message: 'Producto creado' }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // PUT /productos/:id - Actualizar
      if (path.startsWith('/productos/') && method === 'PUT') {
        const id = path.split('/')[2];
        const data = await request.json();
        
        if (!data.nombre || !data.codigo_interno_sku || !data.precio_unitario) {
          return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        if (data.precio_unitario <= 0) {
          return new Response(JSON.stringify({ error: 'El precio debe ser mayor a 0' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const nombreExists = await env.pos_db.prepare('SELECT id FROM productos WHERE nombre = ? AND id != ?').bind(data.nombre, id).first();
        if (nombreExists) {
          return new Response(JSON.stringify({ error: 'El nombre ya existe' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const skuExists = await env.pos_db.prepare('SELECT id FROM productos WHERE codigo_interno_sku = ? AND id != ?').bind(data.codigo_interno_sku, id).first();
        if (skuExists) {
          return new Response(JSON.stringify({ error: 'El SKU ya existe' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        await env.pos_db.prepare(
          'UPDATE productos SET nombre = ?, descripcion = ?, codigo_interno_sku = ?, stock_disponible = ?, habilitar_stock = ?, precio_unitario = ? WHERE id = ?'
        ).bind(
          data.nombre,
          data.descripcion || null,
          data.codigo_interno_sku,
          data.stock_disponible || 0,
          data.habilitar_stock ? 1 : 0,
          data.precio_unitario,
          id
        ).run();
        
        return new Response(JSON.stringify({ message: 'Producto actualizado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // DELETE /productos/:id - Eliminar
      if (path.startsWith('/productos/') && method === 'DELETE') {
        const id = path.split('/')[2];
        await env.pos_db.prepare('DELETE FROM productos WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ message: 'Producto eliminado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ error: 'Ruta no encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};