import mysql.connector
import json

def check_db():
    try:
        conn = mysql.connector.connect(
            host="localhost",
            user="root",
            password="",
            database="logistica_inventario"
        )
        cursor = conn.cursor(dictionary=True)
        
        # Get latest inventario_id
        cursor.execute("SELECT id FROM inventarios ORDER BY id DESC LIMIT 1")
        inv = cursor.fetchone()
        if not inv:
            print("No inventarios found")
            return
        
        inv_id = inv['id']
        print(f"Checking Inventario ID: {inv_id}")
        
        # Count items in datos_sistema_callao
        cursor.execute("SELECT count(*) as count FROM datos_sistema_callao WHERE inventario_id = %s AND estado = 'activo'", (inv_id,))
        ds_count = cursor.fetchone()['count']
        print(f"Items in datos_sistema_callao (activo): {ds_count}")
        
        # Count items in comparaciones_callao
        cursor.execute("SELECT count(*) as count FROM comparaciones_callao WHERE inventario_id = %s", (inv_id,))
        cc_count = cursor.fetchone()['count']
        print(f"Items in comparaciones_callao: {cc_count}")
        
        # Check first 5 items from join
        cursor.execute("""
            SELECT ds.id, ds.codigo, ds.producto, cc.id as comp_id
            FROM datos_sistema_callao ds
            LEFT JOIN comparaciones_callao cc ON ds.inventario_id = cc.inventario_id AND ds.codigo = cc.codigo
            WHERE ds.inventario_id = %s AND ds.estado = 'activo'
            LIMIT 10
        """, (inv_id,))
        rows = cursor.fetchall()
        print("First 10 rows of join:")
        for r in rows:
            print(r)
            
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    check_db()
