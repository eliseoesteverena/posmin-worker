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

		const authenticated = true;

		if (!authenticated) {
			return new Response(
				JSON.stringify({ error: 'Unauthorized' }),
				{
					status: 401,
					headers: {
						...corsHeaders,
						'Content-Type': 'application/json'
					}
				}
			);
		}

		try {

			/* ================= PRODUCTOS ================= */

			if (path === '/productos' && method === 'GET') {

				const { results } = await env.pos_db
					.prepare('SELECT * FROM productos ORDER BY created_at DESC')
					.all();

				return new Response(
					JSON.stringify(results),
					{
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json'
						}
					}
				);
			}


			if (path.startsWith('/productos/') && method === 'GET') {

				const id = path.split('/')[2];

				const result = await env.pos_db
					.prepare('SELECT * FROM productos WHERE id = ?')
					.bind(id)
					.first();

				if (!result) {
					return new Response(
						JSON.stringify({ error: 'Producto no encontrado' }),
						{
							status: 404,
							headers: {
								...corsHeaders,
								'Content-Type': 'application/json'
							}
						}
					);
				}

				return new Response(
					JSON.stringify(result),
					{
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json'
						}
					}
				);
			}


			if (path === '/productos/search' && method === 'POST') {

				const { query } = await request.json();

				const results = await env.pos_db
					.prepare(`
						SELECT *
						FROM productos
						WHERE nombre LIKE ?
						   OR descripcion LIKE ?
						   OR codigo_interno_sku LIKE ?
						   OR codigo_barras LIKE ?
						LIMIT 20
					`)
					.bind(
						`%${query}%`,
						`%${query}%`,
						`%${query}%`,
						`%${query}%`
					)
					.all();

				return new Response(
					JSON.stringify(results.results),
					{
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json'
						}
					}
				);
			}


			/* ================= VALIDACIONES ================= */

			if (path === '/productos/validate/nombre' && method === 'POST') {

				const { nombre, excludeId } = await request.json();

				let query = 'SELECT id FROM productos WHERE nombre = ?';
				const params = [nombre];

				if (excludeId) {
					query += ' AND id != ?';
					params.push(excludeId);
				}

				const result = await env.pos_db
					.prepare(query)
					.bind(...params)
					.first();

				return new Response(
					JSON.stringify({ exists: !!result }),
					{
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json'
						}
					}
				);
			}


			if (path === '/productos/validate/sku' && method === 'POST') {

				const { sku, excludeId } = await request.json();

				let query = 'SELECT id FROM productos WHERE codigo_interno_sku = ?';
				const params = [sku];

				if (excludeId) {
					query += ' AND id != ?';
					params.push(excludeId);
				}

				const result = await env.pos_db
					.prepare(query)
					.bind(...params)
					.first();

				return new Response(
					JSON.stringify({ exists: !!result }),
					{
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json'
						}
					}
				);
			}


			if (path === '/productos/validate/barcode' && method === 'POST') {

				const { barcode, excludeId } = await request.json();

				if (!barcode) {
					return new Response(
						JSON.stringify({ exists: false }),
						{
							headers: {
								...corsHeaders,
								'Content-Type': 'application/json'
							}
						}
					);
				}

				let query = 'SELECT id FROM productos WHERE codigo_barras = ?';
				const params = [barcode];

				if (excludeId) {
					query += ' AND id != ?';
					params.push(excludeId);
				}

				const result = await env.pos_db
					.prepare(query)
					.bind(...params)
					.first();

				return new Response(
					JSON.stringify({ exists: !!result }),
					{
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json'
						}
					}
				);
			}


			/* ================= CREAR PRODUCTO ================= */

			if (path === '/productos' && method === 'POST') {

				const data = await request.json();

				if (!data.nombre || !data.codigo_interno_sku || !data.precio_unitario) {
					return new Response(
						JSON.stringify({ error: 'Faltan campos obligatorios' }),
						{
							status: 400,
							headers: {
								...corsHeaders,
								'Content-Type': 'application/json'
							}
						}
					);
				}

				if (data.precio_unitario <= 0) {
					return new Response(
						JSON.stringify({ error: 'El precio debe ser mayor a 0' }),
						{
							status: 400,
							headers: {
								...corsHeaders,
								'Content-Type': 'application/json'
							}
						}
					);
				}


				const nombreExists = await env.pos_db
					.prepare('SELECT id FROM productos WHERE nombre = ?')
					.bind(data.nombre)
					.first();

				if (nombreExists) {
					return new Response(
						JSON.stringify({ error: 'El nombre ya existe' }),
						{
							status: 409,
							headers: {
								...corsHeaders,
								'Content-Type': 'application/json'
							}
						}
					);
				}


				const skuExists = await env.pos_db
					.prepare('SELECT id FROM productos WHERE codigo_interno_sku = ?')
					.bind(data.codigo_interno_sku)
					.first();

				if (skuExists) {
					return new Response(
						JSON.stringify({ error: 'El SKU ya existe' }),
						{
							status: 409,
							headers: {
								...corsHeaders,
								'Content-Type': 'application/json'
							}
						}
					);
				}


				if (data.codigo_barras) {

					const barcodeExists = await env.pos_db
						.prepare('SELECT id FROM productos WHERE codigo_barras = ?')
						.bind(data.codigo_barras)
						.first();

					if (barcodeExists) {
						return new Response(
							JSON.stringify({ error: 'El código de barras ya existe' }),
							{
								status: 409,
								headers: {
									...corsHeaders,
									'Content-Type': 'application/json'
								}
							}
						);
					}
				}


				const result = await env.pos_db
					.prepare(`
						INSERT INTO productos
						(
							nombre,
							descripcion,
							codigo_interno_sku,
							codigo_barras,
							img,
							stock_disponible,
							habilitar_stock,
							precio_unitario
						)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?)
					`)
					.bind(
						data.nombre,
						data.descripcion || null,
						data.codigo_interno_sku,
						data.codigo_barras || null,
						data.img || null,
						data.stock_disponible || 0,
						data.habilitar_stock ? 1 : 0,
						data.precio_unitario
					)
					.run();


				return new Response(
					JSON.stringify({
						id: result.meta.last_row_id,
						message: 'Producto creado'
					}),
					{
						status: 201,
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json'
						}
					}
				);
			}


			/* ================= ACTUALIZAR PRODUCTO ================= */

			if (path.startsWith('/productos/') && method === 'PUT') {

				const id = path.split('/')[2];
				const data = await request.json();

				if (!data.nombre || !data.codigo_interno_sku || !data.precio_unitario) {
					return new Response(
						JSON.stringify({ error: 'Faltan campos obligatorios' }),
						{
							status: 400,
							headers: {
								...corsHeaders,
								'Content-Type': 'application/json'
							}
						}
					);
				}

				if (data.precio_unitario <= 0) {
					return new Response(
						JSON.stringify({ error: 'El precio debe ser mayor a 0' }),
						{
							status: 400,
							headers: {
								...corsHeaders,
								'Content-Type': 'application/json'
							}
						}
					);
				}


				const nombreExists = await env.pos_db
					.prepare('SELECT id FROM productos WHERE nombre = ? AND id != ?')
					.bind(data.nombre, id)
					.first();

				if (nombreExists) {
					return new Response(
						JSON.stringify({ error: 'El nombre ya existe' }),
						{
							status: 409,
							headers: {
								...corsHeaders,
								'Content-Type': 'application/json'
							}
						}
					);
				}


				const skuExists = await env.pos_db
					.prepare('SELECT id FROM productos WHERE codigo_interno_sku = ? AND id != ?')
					.bind(data.codigo_interno_sku, id)
					.first();

				if (skuExists) {
					return new Response(
						JSON.stringify({ error: 'El SKU ya existe' }),
						{
							status: 409,
							headers: {
								...corsHeaders,
								'Content-Type': 'application/json'
							}
						}
					);
				}


				if (data.codigo_barras) {

					const barcodeExists = await env.pos_db
						.prepare('SELECT id FROM productos WHERE codigo_barras = ? AND id != ?')
						.bind(data.codigo_barras, id)
						.first();

					if (barcodeExists) {
						return new Response(
							JSON.stringify({ error: 'El código de barras ya existe' }),
							{
								status: 409,
								headers: {
									...corsHeaders,
									'Content-Type': 'application/json'
								}
							}
						);
					}
				}


				await env.pos_db
					.prepare(`
						UPDATE productos
						SET
							nombre = ?,
							descripcion = ?,
							codigo_interno_sku = ?,
							codigo_barras = ?,
							img = ?,
							stock_disponible = ?,
							habilitar_stock = ?,
							precio_unitario = ?
						WHERE id = ?
					`)
					.bind(
						data.nombre,
						data.descripcion || null,
						data.codigo_interno_sku,
						data.codigo_barras || null,
						data.img || null,
						data.stock_disponible || 0,
						data.habilitar_stock ? 1 : 0,
						data.precio_unitario,
						id
					)
					.run();


				return new Response(
					JSON.stringify({ message: 'Producto actualizado' }),
					{
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json'
						}
					}
				);
			}


			/* ================= ELIMINAR PRODUCTO ================= */

			if (path.startsWith('/productos/') && method === 'DELETE') {

				const id = path.split('/')[2];

				await env.pos_db
					.prepare('DELETE FROM productos WHERE id = ?')
					.bind(id)
					.run();

				return new Response(
					JSON.stringify({ message: 'Producto eliminado' }),
					{
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json'
						}
					}
				);
			}


			/* ================= VENTAS ================= */

			if (path === '/ventas' && method === 'POST') {

				const data = await request.json();

				const ventaResult = await env.pos_db
					.prepare(`
						INSERT INTO ventas
						(
							tipo,
							subtotal,
							descuento,
							total,
							cliente_nombre,
							cliente_contacto
						)
						VALUES (?, ?, ?, ?, ?, ?)
					`)
					.bind(
						data.tipo,
						data.subtotal,
						data.descuento,
						data.total,
						data.cliente_nombre || null,
						data.cliente_contacto || null
					)
					.run();

				const ventaId = ventaResult.meta.last_row_id;


				for (const item of data.items) {

					await env.pos_db
						.prepare(`
							INSERT INTO items_ventas
							(
								venta_id,
								producto_id,
								producto_nombre,
								producto_sku,
								cantidad,
								precio_unitario,
								subtotal,
								es_personalizado
							)
							VALUES (?, ?, ?, ?, ?, ?, ?, ?)
						`)
						.bind(
							ventaId,
							item.producto_id || null,
							item.nombre,
							item.codigo_interno_sku,
							item.cantidad,
							item.precio_unitario,
							item.subtotal,
							item.es_personalizado ? 1 : 0
						)
						.run();
				}


				return new Response(
					JSON.stringify({
						id: ventaId,
						message: 'Venta registrada'
					}),
					{
						status: 201,
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json'
						}
					}
				);
			}


			if (path === '/ventas' && method === 'GET') {

				const { results } = await env.pos_db
					.prepare('SELECT * FROM ventas ORDER BY fecha_creacion DESC LIMIT 50')
					.all();

				return new Response(
					JSON.stringify(results),
					{
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json'
						}
					}
				);
			}


			if (path.startsWith('/ventas/') && method === 'GET') {

				const id = path.split('/')[2];

				const venta = await env.pos_db
					.prepare('SELECT * FROM ventas WHERE id = ?')
					.bind(id)
					.first();

				if (!venta) {
					return new Response(
						JSON.stringify({ error: 'Venta no encontrada' }),
						{
							status: 404,
							headers: {
								...corsHeaders,
								'Content-Type': 'application/json'
							}
						}
					);
				}


				const items = await env.pos_db
					.prepare('SELECT * FROM items_ventas WHERE venta_id = ?')
					.bind(id)
					.all();


				return new Response(
					JSON.stringify({
						...venta,
						items: items.results
					}),
					{
						headers: {
							...corsHeaders,
							'Content-Type': 'application/json'
						}
					}
				);
			}


			/* ================= DEFAULT ================= */

			return new Response(
				JSON.stringify({ error: 'Ruta no encontrada' }),
				{
					status: 404,
					headers: {
						...corsHeaders,
						'Content-Type': 'application/json'
					}
				}
			);

		} catch (error) {

			return new Response(
				JSON.stringify({
					error: error.message,
					stack: error.stack
				}),
				{
					status: 500,
					headers: {
						...corsHeaders,
						'Content-Type': 'application/json'
					}
				}
			);
		}
	}
};