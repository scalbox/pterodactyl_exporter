import unittest
from pterodactyl_exporter.dto.config import Config


class TestConfig(unittest.TestCase):
    def test_server_uuid_filter_defaults(self):
        config = Config(
            host="example.com", port=9531, api_key="test", https=True,
            ignore_ssl=False, server_list_type="owner"
        )
        self.assertEqual(config.include_servers, [])
        self.assertEqual(config.exclude_servers, [])

    def test_server_uuid_filter_normalization(self):
        config = Config(
            host="example.com", port=9531, api_key="test", https=True,
            ignore_ssl=False, server_list_type="owner",
            include_servers=["  AAAAAAAA-1111-4111-8111-111111111111  "],
            exclude_servers=["BBBBBBBB-2222-4222-8222-222222222222"]
        )
        self.assertEqual(config.include_servers, ["aaaaaaaa-1111-4111-8111-111111111111"])
        self.assertEqual(config.exclude_servers, ["bbbbbbbb-2222-4222-8222-222222222222"])

    def test_server_uuid_filter_invalid_value(self):
        for value in ("not-a-list", [""], [123]):
            with self.subTest(value=value), self.assertRaises(ValueError):
                Config.validate_include_servers(value)

    def test_validate_port_valid(self):
        self.assertEqual(Config.validate_port(8080, field=None), 8080)

    def test_validate_port_invalid(self):
        with self.assertRaises(ValueError):
            Config.validate_port(70000, field=None)

        with self.assertRaises(ValueError):
            Config.validate_port('abc', field=None)

    def test_validate_server_list_type_valid(self):
        self.assertEqual(Config.validate_server_list_type("", field=None), "")
        self.assertEqual(Config.validate_server_list_type("owner", field=None), "owner")
        self.assertEqual(Config.validate_server_list_type("admin-all", field=None), "admin-all")

    def test_validate_server_list_type_invalid(self):
        with self.assertRaises(ValueError):
            Config.validate_server_list_type("invalid")
        with self.assertRaises(ValueError):
            Config.validate_server_list_type(1234)

    def test_validate_https_valid(self):
        self.assertEqual(Config.validate_https(True, field=None), True)
        self.assertEqual(Config.validate_https(False, field=None), False)
        self.assertEqual(Config.validate_https(0, field=None), False)
        self.assertEqual(Config.validate_https(1, field=None), True)
        self.assertEqual(Config.validate_https(10, field=None), True)
        self.assertEqual(Config.validate_https(-10, field=None), True)

    def test_validate_https_invalid(self):
        with self.assertRaises(ValueError):
            Config.validate_https('abc', field=None)

    def test_validate_ignore_ssl_valid(self):
        self.assertEqual(Config.validate_ignore_ssl(False, field=None), False)

    def test_validate_ignore_ssl_invalid(self):
        with self.assertRaises(ValueError):
            Config.validate_ignore_ssl('abc', field=None)


if __name__ == '__main__':
    unittest.main()
