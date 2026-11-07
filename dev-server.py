"""Serveur local de développement : comme `python3 -m http.server`, mais sans cache
(le navigateur recharge toujours la dernière version des fichiers)."""
import http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
    http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCache).serve_forever()
