# Lokalni server za razvoj: kao `python3 -m http.server`, ali bez keširanja,
# da preglednik uvijek učita najnovije module.
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # Zadani red od 5 veza je premalen kad preglednik odjednom traži sve module (javlja ERR_CONNECTION_RESET).
    request_queue_size = 64


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
Server(("", port), NoCacheHandler).serve_forever()
