import requests
import sys
import json
from datetime import datetime

class StaffNotesAPITester:
    def __init__(self, base_url="https://staffscan-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.company_id = None
        self.employee_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "endpoint": endpoint
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e),
                "endpoint": endpoint
            })
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@test.de", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Admin user role: {response.get('user', {}).get('role')}")
            return True
        return False

    def test_user_login(self):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": "user@test.de", "password": "user123"}
        )
        if success and 'access_token' in response:
            self.user_token = response['access_token']
            print(f"   User role: {response.get('user', {}).get('role')}")
            return True
        return False

    def test_create_company(self):
        """Test company creation (admin only)"""
        success, response = self.run_test(
            "Create Company",
            "POST",
            "companies",
            200,
            data={"name": f"Test Company {datetime.now().strftime('%H%M%S')}"},
            token=self.admin_token
        )
        if success and 'id' in response:
            self.company_id = response['id']
            print(f"   Created company ID: {self.company_id}")
            return True
        return False

    def test_get_companies(self):
        """Test getting companies list"""
        success, response = self.run_test(
            "Get Companies",
            "GET",
            "companies",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Found {len(response)} companies")
            return True
        return False

    def test_create_employee(self):
        """Test employee creation"""
        success, response = self.run_test(
            "Create Employee",
            "POST",
            "employees",
            200,
            data={
                "employee_number": f"EMP{datetime.now().strftime('%H%M%S')}",
                "name": "Test Employee"
            },
            token=self.user_token
        )
        if success and 'id' in response:
            self.employee_id = response['id']
            print(f"   Created employee ID: {self.employee_id}")
            return True
        return False

    def test_get_employees(self):
        """Test getting employees list"""
        success, response = self.run_test(
            "Get Employees",
            "GET",
            "employees",
            200,
            token=self.user_token
        )
        if success:
            print(f"   Found {len(response)} employees")
            return True
        return False

    def test_create_note(self):
        """Test note creation"""
        if not self.employee_id:
            print("❌ Skipping note creation - no employee ID")
            return False
            
        success, response = self.run_test(
            "Create Note",
            "POST",
            "notes",
            200,
            data={
                "employee_id": self.employee_id,
                "note_text": "Test note created during API testing"
            },
            token=self.user_token
        )
        return success

    def test_get_notes(self):
        """Test getting notes list"""
        success, response = self.run_test(
            "Get Notes",
            "GET",
            "notes",
            200,
            token=self.user_token
        )
        if success:
            print(f"   Found {len(response)} notes")
            return True
        return False

    def test_csv_export(self):
        """Test CSV export"""
        success, _ = self.run_test(
            "CSV Export",
            "GET",
            "notes/export/csv",
            200,
            token=self.user_token
        )
        return success

    def test_auth_protection(self):
        """Test that protected endpoints require authentication"""
        success, _ = self.run_test(
            "Auth Protection Test",
            "GET",
            "companies",
            401  # Should fail without token
        )
        return success

def main():
    print("🚀 Starting Staff Notes API Testing...")
    tester = StaffNotesAPITester()

    # Test authentication
    print("\n📋 Testing Authentication...")
    admin_login_ok = tester.test_admin_login()
    user_login_ok = tester.test_user_login()
    
    if not admin_login_ok or not user_login_ok:
        print("❌ Authentication failed, stopping tests")
        print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
        return 1

    # Test admin functions
    print("\n📋 Testing Admin Functions...")
    tester.test_create_company()
    tester.test_get_companies()

    # Test user functions
    print("\n📋 Testing User Functions...")
    tester.test_create_employee()
    tester.test_get_employees()
    tester.test_create_note()
    tester.test_get_notes()
    tester.test_csv_export()

    # Test security
    print("\n📋 Testing Security...")
    tester.test_auth_protection()

    # Print results
    print(f"\n📊 Final Results:")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.failed_tests:
        print(f"\n❌ Failed Tests:")
        for test in tester.failed_tests:
            error_msg = test.get('error', f"Expected {test.get('expected')}, got {test.get('actual')}")
            print(f"  - {test['test']}: {error_msg}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())